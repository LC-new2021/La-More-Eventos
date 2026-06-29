import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const eventoId = searchParams.get("eventoId");

    if (!eventoId) {
      return NextResponse.json({ status: "PENDING", simulated: true });
    }

    const evento = await prisma.evento.findUnique({
      where: { id: eventoId }
    });

    if (!evento) {
      return NextResponse.json({ status: "PENDING", simulated: true });
    }

    const gateway = evento.gatewayActive || "NENHUM";

    if (gateway === "MERCADO_PAGO" && evento.mercadoPagoAccessToken) {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: {
          "Authorization": `Bearer ${evento.mercadoPagoAccessToken}`,
          "Content-Type": "application/json"
        }
      });
      if (response.ok) {
        const data = await response.json();
        let s = "PENDING";
        if (data.status === "approved") s = "CONFIRMED";
        if (data.status === "rejected" || data.status === "cancelled") s = "CANCELLED";
        return NextResponse.json({ status: s, simulated: false });
      }
    }

    if (gateway === "PAGBANK" && evento.pagbankToken) {
      // O PagBank usa a API de Pedidos, mas o txid que geramos no POS pode ser o ID do Pedido
      const url = evento.pagbankToken.startsWith("sandbox") ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com";
      const response = await fetch(`${url}/orders/${id}`, {
        headers: {
          "Authorization": `Bearer ${evento.pagbankToken}`,
          "Content-Type": "application/json"
        }
      });
      if (response.ok) {
        const data = await response.json();
        let s = "PENDING";
        if (data.charges && data.charges.some(c => c.status === "PAID")) s = "CONFIRMED";
        return NextResponse.json({ status: s, simulated: false });
      }
    }

    if (gateway === "ASAAS" && evento.asaasToken) {
      const isSandbox = evento.asaasToken.startsWith("$");
      const url = isSandbox ? "https://sandbox.asaas.com/api" : "https://api.asaas.com";
      const response = await fetch(`${url}/v3/payments/${id}`, {
        headers: {
          "access_token": evento.asaasToken,
          "Content-Type": "application/json"
        }
      });
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({ status: data.status, simulated: false });
      }
    }

    // Se não encontrou ou não tem gateway, apenas retorna pendente
    // O operador vai precisar confirmar manualmente no botão
    return NextResponse.json({ status: "PENDING", simulated: true });

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
