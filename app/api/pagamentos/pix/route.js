import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { criarPixAsaas } from "@/lib/asaas";
import { criarPixMercadoPago } from "@/lib/mercadopago";

export const dynamic = 'force-dynamic';

async function obterTokensGateway(evento) {
  let asaasToken = (evento?.asaasToken || process.env.ASAAS_API_KEY || '').trim();
  let mpToken = (evento?.mercadoPagoAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

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

export async function POST(req) {
  try {
    const { valor, clienteNome, cpf, eventoId, cartaoCodigo } = await req.json();

    if (!valor || parseFloat(valor) <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const value = parseFloat(valor);

    let evento = null;
    if (eventoId) {
      evento = await prisma.evento.findUnique({
        where: { id: eventoId }
      });
    }

    const { asaasToken, mpToken } = await obterTokensGateway(evento);

    const codigoPedido = `REC-${(cartaoCodigo || 'CARTAO').toUpperCase()}-${Date.now()}`;
    const payer = {
      nomeCompleto: clienteNome || "Consumidor La More",
      cpf: cpf ? cpf.replace(/\D/g, "") : "",
      email: "financeiro@lamore.com.br",
    };

    let pixResult = null;

    // 1. Tenta criar PIX oficial no Banco Asaas
    if (asaasToken && evento?.gatewayActive !== "MERCADO_PAGO") {
      try {
        const asaasPix = await criarPixAsaas({
          token: asaasToken,
          valor: value,
          descricao: `Recarga Saldo - Cartao ${cartaoCodigo || ""}`,
          codigoPedido,
          payer,
        });

        pixResult = {
          paymentId: asaasPix.paymentId,
          txid: asaasPix.paymentId,
          pixPayload: asaasPix.qrCode,
          qrCodeUrl: asaasPix.qrCodeBase64 
            ? `data:image/png;base64,${asaasPix.qrCodeBase64}`
            : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(asaasPix.qrCode)}`,
          valor: value,
        };
      } catch (errAsaas) {
        console.warn("[PIX ROUTE] Aviso Asaas:", errAsaas.message);
      }
    }

    // 2. Se não gerou via Asaas, tenta Mercado Pago
    if (!pixResult && mpToken) {
      try {
        const mpPix = await criarPixMercadoPago({
          token: mpToken,
          valor: value,
          descricao: `Recarga Saldo - Cartao ${cartaoCodigo || ""}`,
          codigoPedido,
          payer,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://la-more-eventos-production.up.railway.app",
        });

        pixResult = {
          paymentId: mpPix.paymentId,
          txid: mpPix.paymentId,
          pixPayload: mpPix.qrCode,
          qrCodeUrl: mpPix.qrCodeBase64 
            ? `data:image/jpeg;base64,${mpPix.qrCodeBase64}`
            : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mpPix.qrCode)}`,
          valor: value,
        };
      } catch (errMp) {
        console.error("[PIX ROUTE] Erro Mercado Pago:", errMp.message);
        throw new Error(`Falha ao gerar cobrança PIX no banco: ${errMp.message}`);
      }
    }

    if (!pixResult) {
      throw new Error("Nenhum gateway bancário disponível para emitir PIX dinâmico.");
    }

    return NextResponse.json(pixResult);
  } catch (e) {
    console.error("[ERRO GERAR PIX]:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
