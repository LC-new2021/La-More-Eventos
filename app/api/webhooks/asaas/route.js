import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const body = await req.json();

    // Eventos enviados pelo Asaas:
    // PAYMENT_CONFIRMED ou PAYMENT_RECEIVED indicam sucesso
    if (body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED") {
      const payment = body.payment;
      const paymentId = payment.id;
      const txid = payment.externalReference;
      const valor = payment.value;

      console.log(`[Asaas Webhook] Pagamento Confirmado. ID Asaas: ${paymentId}, Ref Interna: ${txid}, Valor: R$ ${valor}`);

      if (txid && txid.startsWith("RECARGA_PIX_")) {
        const codigo = txid.replace("RECARGA_PIX_", "").toUpperCase();
        
        const cartao = await prisma.cartao.findUnique({
          where: { codigo },
          include: { cliente: true }
        });

        if (cartao) {
          const evento = await prisma.evento.findUnique({ where: { id: cartao.eventoId } });
          const taxaPct = evento?.taxaMasterPercent || 0;
          const valorTaxaMaster = (valor * taxaPct) / 100;

          await prisma.$transaction([
            prisma.cartao.update({
              where: { id: cartao.id },
              data: { saldo: { increment: valor } }
            }),
            prisma.movimentacao.create({
              data: {
                tipo: 'RECARGA',
                valor: valor,
                descricao: `Recarga Pix Online (Asaas)`,
                cartaoId: cartao.id,
                gatewayId: paymentId,
                gatewayStatus: "CONFIRMADO",
                valorTaxaMaster
              }
            })
          ]);

          // Enviar push de recarga Asaas
          if (cartao.cliente?.pushSubscriptionJson) {
            const { enviarNotificacao } = require('@/lib/push');
            const formattedValue = valor.toFixed(2).replace('.', ',');
            const formattedSaldo = (cartao.saldo + valor).toFixed(2).replace('.', ',');
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
            const formattedValue = valor.toFixed(2).replace('.', ',');
            const formattedSaldo = (cartao.saldo + valor).toFixed(2).replace('.', ',');
            operadores.forEach(operador => {
              enviarNotificacao(
                operador.pushSubscriptionJson,
                'Nova Recarga Confirmada ⚡',
                `O cliente ${cartao.cliente.nome} realizou recarga online de R$ ${formattedValue}. Novo saldo: R$ ${formattedSaldo}.`,
                '/pos'
              ).catch(console.error);
            });
          } catch (pushError) {
            console.error('Erro ao notificar operadores no Asaas Webhook:', pushError);
          }

          console.log(`[Asaas Webhook] Cartão ${codigo} recarregado com R$ ${valor} via Pix.`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Erro no webhook do Asaas:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
