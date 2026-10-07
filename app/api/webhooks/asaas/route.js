import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processarRecargaIdempotente, buscarCartao } from "@/lib/recarga-service";

export async function POST(req) {
  try {
    const body = await req.json();

    // Eventos enviados pelo Asaas indicando sucesso no pagamento
    if (body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED") {
      const payment = body.payment || {};
      const paymentId = payment.id;
      const txid = payment.externalReference || "";
      const description = payment.description || "";
      const valor = parseFloat(payment.value || 0);

      console.log(`[Asaas Webhook] Pagamento Confirmado. Evento: ${body.event}, ID Asaas: ${paymentId}, Ref Interna: ${txid}, Valor: R$ ${valor}`);

      if (!paymentId || valor <= 0) {
        return NextResponse.json({ received: true });
      }

      // Extrai o código do cartão da referência externa ou da descrição
      let codigo = "";
      if (txid.startsWith("RECARGA_PIX_")) {
        codigo = txid.replace("RECARGA_PIX_", "").trim().toUpperCase();
      } else if (txid.startsWith("REC-")) {
        const parts = txid.split("-");
        // REC-[CODIGO]-[TIMESTAMP]
        if (parts.length >= 3) {
          codigo = parts.slice(1, -1).join("-").trim().toUpperCase();
        } else if (parts.length === 2) {
          codigo = parts[1].trim().toUpperCase();
        }
      } else if (txid.startsWith("REC_")) {
        codigo = txid.replace("REC_", "").split("_")[0].trim().toUpperCase();
      }

      // Fallback: tenta extrair da descrição caso não tenha vindo no externalReference
      if (!codigo && description) {
        const match = description.match(/Cart[aã]o\s+([A-Za-z0-9\-]+)/i);
        if (match && match[1]) {
          codigo = match[1].trim().toUpperCase();
        }
      }

      // Fallback 2: busca se já existe uma movimentação pendente com esse gatewayId
      let cartao = null;
      if (codigo) {
        cartao = await buscarCartao(codigo);
      }
      if (!cartao) {
        const movExistente = await prisma.movimentacao.findFirst({
          where: { gatewayId: paymentId },
          include: { cartao: true },
        });
        if (movExistente?.cartao) {
          cartao = movExistente.cartao;
        }
      }

      if (cartao) {
        const resultado = await processarRecargaIdempotente({
          cartaoId: cartao.id,
          valor: valor,
          gatewayId: paymentId,
          gatewayStatus: "CONFIRMADO",
          descricao: `Recarga Pix Online (Asaas)`,
          operadorNome: "Asaas Webhook",
        });

        if (resultado.jaProcessado) {
          console.log(`[Asaas Webhook] Pagamento ${paymentId} já havia sido processado. Bloqueado duplicidade com sucesso.`);
        } else {
          console.log(`[Asaas Webhook] Cartão ${cartao.codigo} recarregado com R$ ${valor}. Novo saldo: R$ ${resultado.novoSaldo}`);
        }
      } else {
        console.warn(`[Asaas Webhook] Cartão não localizado para pagamento ${paymentId} (Ref: ${txid}, Desc: ${description})`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Erro no webhook do Asaas:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
