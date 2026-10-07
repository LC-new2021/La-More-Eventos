import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processarRecargaIdempotente, buscarCartao } from "@/lib/recarga-service";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const pixPayment = body?.pix?.[0];
    let txid = pixPayment?.txid || body?.reference_id || body?.id || body?.reference;
    let valor = parseFloat(pixPayment?.valor || body?.charges?.[0]?.amount?.value ? (body.charges[0].amount.value / 100) : (body?.value || 0));
    let status = pixPayment ? "PAID" : (body?.status || body?.charges?.[0]?.status);

    if (txid && (status === "PAID" || status === "COMPLETED" || status === "AUTHORIZED") && valor > 0) {
      console.log(`[PagBank Webhook] Pagamento Confirmado. TXID: ${txid}, Valor: R$ ${valor}`);

      let codigo = "";
      if (txid.startsWith("REC_")) {
        codigo = txid.replace("REC_", "").split("_")[0].trim().toUpperCase();
      } else if (txid.startsWith("REC-")) {
        const parts = txid.split("-");
        codigo = (parts.length >= 3 ? parts.slice(1, -1).join("-") : parts[1] || "").trim().toUpperCase();
      }

      let cartao = null;
      if (codigo) {
        cartao = await buscarCartao(codigo);
      }
      if (!cartao) {
        const movExistente = await prisma.movimentacao.findFirst({
          where: { gatewayId: txid.toString() },
          include: { cartao: true },
        });
        if (movExistente?.cartao) {
          cartao = movExistente.cartao;
        }
      }

      if (cartao) {
        await processarRecargaIdempotente({
          cartaoId: cartao.id,
          valor: valor,
          gatewayId: txid.toString(),
          gatewayStatus: "CONFIRMADO",
          descricao: `Recarga Online (PagBank)`,
          operadorNome: "PagBank Webhook",
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Erro no webhook do PagBank:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
