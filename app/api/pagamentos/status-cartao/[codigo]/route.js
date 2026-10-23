import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const codigo = (resolvedParams?.codigo || "").trim().toUpperCase();

    if (!codigo) {
      return NextResponse.json({ status: "PENDING", simulated: true });
    }

    const cartao = await prisma.cartao.findUnique({
      where: { codigo },
      include: {
        evento: true,
        movimentacoes: {
          where: { tipo: "RECARGA" },
          orderBy: { criadaEm: "desc" },
          take: 1,
        },
      },
    });

    if (!cartao || !cartao.evento) {
      return NextResponse.json({ status: "PENDING", simulated: true });
    }

    // 1. Verifica se uma recarga de gateway entrou nos últimos 2 minutos (via Webhook)
    const ultimaRecarga = cartao.movimentacoes?.[0];
    if (ultimaRecarga && ultimaRecarga.gatewayId) {
      const diffSeconds = (Date.now() - new Date(ultimaRecarga.criadaEm).getTime()) / 1000;
      if (diffSeconds < 120) {
        return NextResponse.json({
          status: "CONFIRMED",
          gatewayId: ultimaRecarga.gatewayId,
          simulated: false,
        });
      }
    }

    const evento = cartao.evento;
    const gateway = (evento.gatewayActive || "ASAAS").toUpperCase();

    // 2. Consulta Mercado Pago por external_reference
    const mpToken = (evento.mercadoPagoAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
    if ((gateway === "MERCADO_PAGO" || mpToken) && mpToken) {
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(codigo)}&status=approved&sort=date_created&criteria=desc`,
        {
          headers: {
            Authorization: `Bearer ${mpToken}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const latestPayment = data.results[0];
          const paymentDate = new Date(latestPayment.date_created);
          const diffHours = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60);

          if (diffHours < 12) {
            return NextResponse.json({
              status: "CONFIRMED",
              gatewayId: latestPayment.id.toString(),
              simulated: false,
            });
          }
        }
      }
    }

    // 3. Consulta Asaas por externalReference
    const asaasToken = (evento.asaasToken || process.env.ASAAS_API_KEY || "").trim();
    if ((gateway === "ASAAS" || asaasToken) && asaasToken) {
      const isSandbox = asaasToken.toLowerCase().includes("sandbox");
      const baseUrl = isSandbox ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
      const response = await fetch(
        `${baseUrl}/payments?externalReference=${encodeURIComponent(codigo)}&limit=5`,
        {
          headers: {
            access_token: asaasToken,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      if (response.ok) {
        const data = await response.json();
        const confirmado = data.data?.find(
          (p) => p.status === "CONFIRMED" || p.status === "RECEIVED"
        );
        if (confirmado) {
          return NextResponse.json({
            status: "CONFIRMED",
            gatewayId: confirmado.id,
            simulated: false,
          });
        }
      }
    }

    return NextResponse.json({ status: "PENDING", simulated: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
