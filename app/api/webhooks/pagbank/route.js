import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const body = await req.json();

    // Exemplo de payload do PagBank Pix Webhook:
    // {
    //   "pix": [
    //     {
    //       "txid": "TXID...",
    //       "valor": "100.00",
    //       "horario": "2026-05-27T11:20:00Z"
    //     }
    //   ]
    // }

    const pixPayment = body?.pix?.[0];
    if (!pixPayment) {
      // Também pode ser webhook de notificação v2 padrão
      const notification = body;
      const txid = notification.reference || notification.id;
      const status = notification.status;

      if (status === "PAID" || status === "COMPLETED") {
        // Processar liquidação
        console.log(`Pagamento recebido via Webhook PagBank. ID: ${txid}`);
      }
      return NextResponse.json({ ok: true });
    }

    const { txid, valor } = pixPayment;
    console.log(`Notificação de Pix recebida do PagBank: TXID: ${txid}, Valor: ${valor}`);

    // Procurar alguma recarga em aberto ou processar a recarga do cartão correspondente
    // Em produção, associaríamos o TXID à transação/cartão no banco de dados.

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Erro no webhook do PagBank:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
