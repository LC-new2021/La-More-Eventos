import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processarRecargaIdempotente, buscarCartao } from "@/lib/recarga-service";

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    // Mercado Pago envia webhooks informando a ação
    if (body.action === "payment.created" || body.action === "payment.updated" || body.type === "payment" || searchParams.get("topic") === "payment") {
      const paymentId = body.data?.id || body.id || searchParams.get("id");

      if (paymentId) {
        const webhookEventoId = searchParams.get("eventoId");

        let mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        let eventRecord = null;

        if (webhookEventoId) {
          eventRecord = await prisma.evento.findUnique({
            where: { id: webhookEventoId },
          });
          if (eventRecord?.mercadoPagoAccessToken) {
            mpAccessToken = eventRecord.mercadoPagoAccessToken;
          }
        }

        if (!mpAccessToken) {
          const eventos = await prisma.evento.findMany();
          for (const ev of eventos) {
            if (ev.mercadoPagoAccessToken && ev.mercadoPagoAccessToken.trim().length > 10) {
              mpAccessToken = ev.mercadoPagoAccessToken.trim();
              break;
            }
          }
        }

        if (mpAccessToken) {
          const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
              Authorization: `Bearer ${mpAccessToken}`,
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const paymentData = await response.json();

            if (paymentData.status === "approved") {
              const txid = paymentData.external_reference || "";
              const value = parseFloat(paymentData.transaction_amount || 0);
              const description = paymentData.description || "";

              let codigo = "";
              if (txid.startsWith("REC-")) {
                const parts = txid.split("-");
                if (parts.length >= 3) {
                  codigo = parts.slice(1, -1).join("-").trim().toUpperCase();
                } else if (parts.length === 2) {
                  codigo = parts[1].trim().toUpperCase();
                }
              } else if (txid.startsWith("RECARGA_PIX_")) {
                codigo = txid.replace("RECARGA_PIX_", "").trim().toUpperCase();
              } else if (txid.startsWith("REC_")) {
                codigo = txid.replace("REC_", "").split("_")[0].trim().toUpperCase();
              } else if (txid && !txid.includes(" ")) {
                codigo = txid.trim().toUpperCase();
              }

              if (!codigo && description) {
                const match = description.match(/Cart[aã]o(?:\s+Virtual)?\s+([A-Za-z0-9\-]+)/i);
                if (match && match[1]) {
                  codigo = match[1].trim().toUpperCase();
                }
              }

              let cartao = null;
              if (codigo) {
                cartao = await buscarCartao(codigo);
              }
              if (!cartao) {
                const movExistente = await prisma.movimentacao.findFirst({
                  where: { gatewayId: paymentId.toString() },
                  include: { cartao: true },
                });
                if (movExistente?.cartao) {
                  cartao = movExistente.cartao;
                }
              }

              if (cartao && value > 0) {
                const resultado = await processarRecargaIdempotente({
                  cartaoId: cartao.id,
                  valor: value,
                  gatewayId: paymentId.toString(),
                  gatewayStatus: "CONFIRMADO",
                  descricao: `Recarga Carteira Digital / Pix Webhook (${(paymentData.payment_method_id || "MP").toUpperCase()})`,
                  operadorNome: "Mercado Pago Webhook",
                });

                if (resultado.jaProcessado) {
                  console.log(`[Mercado Pago Webhook] Pagamento ${paymentId} já havia sido creditado. Bloqueado duplicidade com sucesso.`);
                } else {
                  console.log(`[Mercado Pago Webhook] Cartão ${cartao.codigo} recarregado com R$ ${value}. Novo saldo: R$ ${resultado.novoSaldo}`);
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
