import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processarRecargaIdempotente, buscarCartao } from "@/lib/recarga-service";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      token,
      paymentMethodId,
      issuerId,
      installments,
      transactionAmount,
      payerEmail,
      cartaoCodigo,
      eventoId
    } = body;

    if (!transactionAmount || parseFloat(transactionAmount) <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    if (!cartaoCodigo) {
      return NextResponse.json({ error: "Código do cartão é obrigatório" }, { status: 400 });
    }

    const value = parseFloat(transactionAmount);

    // 1. Obter credenciais do evento
    const evento = await prisma.evento.findUnique({
      where: { id: eventoId }
    });

    if (!evento) {
      return NextResponse.json({ error: "Evento não localizado" }, { status: 404 });
    }

    const mpAccessToken = evento.mercadoPagoAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!mpAccessToken) {
      // Se não estiver configurado o Mercado Pago, simula aprovação automática (modo testes/fallback)
      const simulatedId = "simulated_wallet_" + Date.now();
      const resultado = await processarRecargaIdempotente({
        cartaoCodigo,
        valor: value,
        gatewayId: simulatedId,
        gatewayStatus: "SIMULADO",
        descricao: `Recarga Carteira Digital (Simulada ${paymentMethodId || 'WALLET'})`,
        operadorNome: "Sistema (Simulado)",
      });

      return NextResponse.json({ success: true, status: "approved", id: simulatedId, cartao: resultado.cartao });
    }

    // 2. Chamar a API real do Mercado Pago
    const taxaPct = evento.taxaMasterPercent || 0;
    const applicationFee = parseFloat(((value * taxaPct) / 100).toFixed(2));

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": "MP_WALLET_" + Date.now().toString(36).toUpperCase()
      },
      body: JSON.stringify({
        token,
        payment_method_id: paymentMethodId,
        ...(issuerId && { issuer_id: issuerId }),
        installments: parseInt(installments) || 1,
        transaction_amount: value,
        description: `Recarga Cartão Virtual ${cartaoCodigo.toUpperCase()}`,
        payer: {
          email: payerEmail || "financeiro@grupolamore.com.br"
        },
        ...(applicationFee > 0 && { application_fee: applicationFee })
      })
    });

    const paymentData = await response.json();

    if (!response.ok || paymentData.status === "rejected") {
      const errorMsg = paymentData.message || paymentData.cause?.[0]?.description || "Transação recusada pelo emissor.";
      return NextResponse.json({ error: errorMsg, details: paymentData }, { status: response.ok ? 400 : response.status });
    }

    // 3. Se aprovado, credita de forma idempotente
    const aprovado = paymentData.status === "approved";
    if (aprovado) {
      await processarRecargaIdempotente({
        cartaoCodigo,
        valor: value,
        gatewayId: paymentData.id.toString(),
        gatewayStatus: "CONFIRMADO",
        descricao: `Recarga Carteira Digital (${(paymentMethodId || 'WALLET').toUpperCase()})`,
        operadorNome: "Mercado Pago Wallet",
      });
    }

    return NextResponse.json({
      success: aprovado,
      status: paymentData.status,
      id: paymentData.id
    });

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
