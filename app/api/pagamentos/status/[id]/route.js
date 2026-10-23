import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { consultarPagamentoAsaas } from "@/lib/asaas";
import { consultarPagamentoMercadoPago } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

async function obterTokensGateway(evento) {
  let asaasToken = (evento?.asaasToken || process.env.ASAAS_API_KEY || "").trim();
  let mpToken = (evento?.mercadoPagoAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();

  if (!asaasToken || !mpToken) {
    const eventos = await prisma.evento.findMany();
    for (const ev of eventos) {
      if (!asaasToken && ev.asaasToken && ev.asaasToken.trim().length > 10) {
        asaasToken = ev.asaasToken.trim();
      }
      if (!mpToken && ev.mercadoPagoAccessToken && ev.mercadoPagoAccessToken.trim().length > 10) {
        mpToken = ev.mercadoPagoAccessToken.trim();
      }
    }
  }

  return { asaasToken, mpToken };
}

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const id = (resolvedParams?.id || "").trim();
    const { searchParams } = new URL(req.url);
    const eventoId = searchParams.get("eventoId");

    if (!id) {
      return NextResponse.json({ status: "PENDING", simulated: true });
    }

    // 1. Verifica se já foi confirmado via Webhook no banco de dados
    const movExistente = await prisma.movimentacao.findFirst({
      where: { gatewayId: id },
    });
    if (movExistente && (movExistente.gatewayStatus === "CONFIRMADO" || movExistente.tipo === "RECARGA")) {
      return NextResponse.json({ status: "CONFIRMED", simulated: false, gatewayId: id });
    }

    let evento = null;
    if (eventoId) {
      evento = await prisma.evento.findUnique({
        where: { id: eventoId }
      });
    }

    const { asaasToken, mpToken } = await obterTokensGateway(evento);
    const gateway = (evento?.gatewayActive || "ASAAS").toUpperCase();

    // 2. Se for ID do Asaas (inicia com 'pay_') ou gateway for ASAAS
    if ((id.startsWith("pay_") || gateway === "ASAAS") && asaasToken && !id.startsWith("PIX_DIR_")) {
      const data = await consultarPagamentoAsaas({ token: asaasToken, paymentId: id });
      if (data && data.status) {
        return NextResponse.json({ status: data.status, simulated: false, gateway: "ASAAS" });
      }
    }

    // 3. Se for numérico ou gateway for MERCADO_PAGO
    if ((/^\d+$/.test(id) || gateway === "MERCADO_PAGO") && mpToken && !id.startsWith("PIX_DIR_")) {
      const data = await consultarPagamentoMercadoPago({ token: mpToken, paymentId: id });
      if (data && data.status) {
        let s = "PENDING";
        if (data.status === "approved") s = "CONFIRMED";
        if (data.status === "rejected" || data.status === "cancelled") s = "CANCELLED";
        return NextResponse.json({ status: s, simulated: false, gateway: "MERCADO_PAGO" });
      }
    }

    // 4. Se for PagBank
    if (gateway === "PAGBANK" && evento?.pagbankToken) {
      const url = evento.pagbankToken.toLowerCase().includes("sandbox") ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com";
      const response = await fetch(`${url}/orders/${id}`, {
        headers: {
          "Authorization": `Bearer ${evento.pagbankToken}`,
          "Content-Type": "application/json"
        },
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        let s = "PENDING";
        if (data.charges && data.charges.some(c => c.status === "PAID" || c.status === "AUTHORIZED")) s = "CONFIRMED";
        return NextResponse.json({ status: s, simulated: false, gateway: "PAGBANK" });
      }
    }

    // Se não encontrou ou é PIX_DIRETO estático, retorna pendente
    return NextResponse.json({ status: "PENDING", simulated: id.startsWith("PIX_DIR_") });

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
