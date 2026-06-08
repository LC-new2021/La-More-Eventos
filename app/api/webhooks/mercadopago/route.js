import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json();

    // Mercado Pago envia webhooks informando a ação
    // Os webhooks de pagamento possuem action: "payment.created" ou "payment.updated"
    if (body.action && (body.action === "payment.created" || body.action === "payment.updated")) {
      const paymentId = body.data?.id;

      if (paymentId) {
        // Obter os detalhes do pagamento na API do Mercado Pago
        // Como o webhook pode vir sem o eventoId no corpo, buscamos na query do webhook
        // (Ao cadastrar o webhook no Mercado Pago, passamos ?eventoId=xxx no URL)
        const webhookEventoId = searchParams.get("eventoId");

        let mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        let eventRecord = null;

        if (webhookEventoId) {
          eventRecord = await prisma.evento.findUnique({
            where: { id: webhookEventoId }
          });
          if (eventRecord?.mercadoPagoAccessToken) {
            mpAccessToken = eventRecord.mercadoPagoAccessToken;
          }
        }

        if (mpAccessToken) {
          const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
              "Authorization": `Bearer ${mpAccessToken}`,
              "Content-Type": "application/json"
            }
          });

          if (response.ok) {
            const paymentData = await response.json();

            if (paymentData.status === "approved") {
              const txid = paymentData.external_reference; 
              const value = paymentData.transaction_amount;
              const description = paymentData.description; // Contém o código do cartão

              // Localiza o código do cartão na descrição ("Recarga Cartão Virtual LM...")
              let codigo = "";
              if (description && description.includes("Recarga Cartão Virtual ")) {
                codigo = description.replace("Recarga Cartão Virtual ", "").trim().toUpperCase();
              }

              if (codigo) {
                // Verificar se a movimentação já foi gravada
                const movExistente = await prisma.movimentacao.findFirst({
                  where: { gatewayId: paymentId.toString() }
                });

                if (!movExistente) {
                  const cartao = await prisma.cartao.findUnique({
                    where: { codigo },
                    include: { cliente: true }
                  });

                  if (cartao) {
                    const taxaPct = eventRecord?.taxaMasterPercent || 0;
                    const valorTaxaMaster = (value * taxaPct) / 100;

                    await prisma.$transaction([
                      prisma.cartao.update({
                        where: { id: cartao.id },
                        data: { saldo: { increment: value } }
                      }),
                      prisma.movimentacao.create({
                        data: {
                          tipo: "RECARGA",
                          valor: value,
                          descricao: `Recarga Carteira Digital Webhook (${paymentData.payment_method_id.toUpperCase()})`,
                          cartaoId: cartao.id,
                          gatewayId: paymentId.toString(),
                          gatewayStatus: "CONFIRMADO",
                          valorTaxaMaster
                        }
                      })
                    ]);

                    // Enviar push de recarga webhook Mercado Pago
                    if (cartao.cliente?.pushSubscriptionJson) {
                      const { enviarNotificacao } = require('@/lib/push');
                      const formattedValue = value.toFixed(2).replace('.', ',');
                      const formattedSaldo = (cartao.saldo + value).toFixed(2).replace('.', ',');
                      enviarNotificacao(
                        cartao.cliente.pushSubscriptionJson,
                        'Saldo Adicionado! ⚡',
                        `Recarga de R$ ${formattedValue} creditada. Novo saldo: R$ ${formattedSaldo}.`,
                        `/cartao/${codigo.toUpperCase()}`
                      ).catch(console.error);
                    }

                    // Notificar operadores vinculados ao evento
                    try {
                      const { enviarNotificacao } = require('@/lib/push');
                      const operadores = await prisma.usuario.findMany({
                        where: {
                          eventoId: cartao.eventoId,
                          pushSubscriptionJson: { not: null }
                        }
                      });
                      const formattedValue = value.toFixed(2).replace('.', ',');
                      const formattedSaldo = (cartao.saldo + value).toFixed(2).replace('.', ',');
                      operadores.forEach(operador => {
                        enviarNotificacao(
                          operador.pushSubscriptionJson,
                          'Nova Recarga Confirmada ⚡',
                          `O cliente ${cartao.cliente.nome} realizou recarga online de R$ ${formattedValue}. Novo saldo: R$ ${formattedSaldo}.`,
                          '/pos'
                        ).catch(console.error);
                      });
                    } catch (pushError) {
                      console.error('Erro ao notificar operadores no Mercado Pago Webhook:', pushError);
                    }

                    console.log(`[Mercado Pago Webhook] Cartão ${codigo} recarregado com R$ ${value} via Webhook.`);
                  }
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Erro no webhook do Mercado Pago:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
