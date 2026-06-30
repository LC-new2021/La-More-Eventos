import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req, { params }) {
  try {
    const { codigo } = params;
    
    if (!codigo) {
      return NextResponse.json({ status: "PENDING", simulated: true });
    }

    const cartao = await prisma.cartao.findUnique({
      where: { codigo: codigo.toUpperCase() },
      include: { evento: true }
    });

    if (!cartao || !cartao.evento) {
      return NextResponse.json({ status: "PENDING", simulated: true });
    }

    const evento = cartao.evento;
    const gateway = evento.gatewayActive || "NENHUM";

    if (gateway === "MERCADO_PAGO" && evento.mercadoPagoAccessToken) {
      // Busca os pagamentos aprovados recentes com esse external_reference
      const response = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${codigo}&status=approved&sort=date_created&criteria=desc`, {
        headers: {
          "Authorization": `Bearer ${evento.mercadoPagoAccessToken}`,
          "Content-Type": "application/json"
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Verifica se há algum pagamento aprovado nas últimas 12 horas
        if (data.results && data.results.length > 0) {
          const latestPayment = data.results[0];
          const paymentDate = new Date(latestPayment.date_created);
          const now = new Date();
          const diffHours = (now - paymentDate) / (1000 * 60 * 60);
          
          if (diffHours < 12) {
            return NextResponse.json({ status: "CONFIRMED", gatewayId: latestPayment.id.toString(), simulated: false });
          }
        }
      }
    }

    return NextResponse.json({ status: "PENDING", simulated: true });

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
