import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { criarPixAsaas } from "@/lib/asaas";
import { criarPixMercadoPago } from "@/lib/mercadopago";
import { gerarPixCompleto } from "@/lib/pix";

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

    // 1. Tenta criar PIX oficial no Banco Asaas se o gateway configurado for ASAAS
    if (asaasToken && evento?.gatewayActive === "ASAAS") {
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
          isGateway: true,
        };
      } catch (errAsaas) {
        console.warn("[PIX ROUTE] Aviso Asaas:", errAsaas.message);
      }
    }

    // 2. Tenta Mercado Pago se o gateway configurado for MERCADO_PAGO
    if (!pixResult && mpToken && evento?.gatewayActive === "MERCADO_PAGO") {
      try {
        const mpPix = await criarPixMercadoPago({
          token: mpToken,
          valor: value,
          descricao: `Recarga Saldo - Cartao ${cartaoCodigo || ""}`,
          codigoPedido,
          payer,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://eventos.grupolamore.com.br",
        });

        pixResult = {
          paymentId: mpPix.paymentId,
          txid: mpPix.paymentId,
          pixPayload: mpPix.qrCode,
          qrCodeUrl: mpPix.qrCodeBase64 
            ? `data:image/jpeg;base64,${mpPix.qrCodeBase64}`
            : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mpPix.qrCode)}`,
          valor: value,
          isGateway: true,
        };
      } catch (errMp) {
        console.warn("[PIX ROUTE] Aviso Mercado Pago:", errMp.message);
      }
    }

    // 3. Fallback PIX Direto (Chave do Produtor / BR Code Oficial Banco Central)
    if (!pixResult) {
      const chavePix = evento?.chavePix || process.env.PIX_CHAVE_PADRAO || '61993688095';
      const titular = evento?.titularPix || evento?.nome || "LEONARDO CAVALCANTI";
      const cidade = evento?.cidadePix || "BRASILIA";

      const pixDireto = await gerarPixCompleto({
        chave: chavePix,
        valor: value,
        nomeRecebedor: titular,
        cidade: cidade,
        txid: "***",
        descricao: `Recarga Cartao ${cartaoCodigo || ""}`.trim(),
      });

      pixResult = {
        paymentId: `PIX_DIR_${cartaoCodigo || 'REC'}_${Date.now()}`,
        txid: `PIX_DIR_${cartaoCodigo || 'REC'}_${Date.now()}`,
        pixPayload: pixDireto.copiaCola,
        qrCodeUrl: `data:image/png;base64,${pixDireto.qrCodeBase64}`,
        valor: value,
        isGateway: false,
        chavePix,
        titular,
      };
    }

    return NextResponse.json(pixResult);
  } catch (e) {
    console.error("[ERRO GERAR PIX]:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
