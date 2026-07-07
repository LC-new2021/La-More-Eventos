import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
      const cartao = await prisma.cartao.findUnique({
        where: { codigo: cartaoCodigo.toUpperCase() },
        include: { cliente: true }
      });
      if (cartao) {
        const taxaPct = evento.taxaMasterPercent || 0;
        const valorTaxaMaster = (value * taxaPct) / 100;
        await prisma.$transaction([
          prisma.cartao.update({
            where: { id: cartao.id },
            data: { saldo: { increment: value } }
          }),
          prisma.movimentacao.create({
            data: {
              tipo: "RECARGA",
              valor: value,
              descricao: `Recarga Carteira Digital (Simulada ${paymentMethodId})`,
              cartaoId: cartao.id,
              gatewayStatus: "SIMULADO",
              valorTaxaMaster
            }
          })
        ]);

        // Enviar push de recarga simulada
        if (cartao.cliente?.pushSubscriptionJson) {
          const { enviarNotificacao } = require('@/lib/push');
          const formattedValue = value.toFixed(2).replace('.', ',');
          const formattedSaldo = (cartao.saldo + value).toFixed(2).replace('.', ',');
          enviarNotificacao(
            cartao.cliente.pushSubscriptionJson,
            'Saldo Adicionado! ⚡',
            `Recarga de R$ ${formattedValue} creditada. Novo saldo: R$ ${formattedSaldo}.`,
            `/cartao/${cartaoCodigo.toUpperCase()}`
          ).catch(console.error);
        }

        // Notificacao para operadores removida para evitar spam
      }
      return NextResponse.json({ success: true, status: "approved", id: "simulated_" + Date.now() });
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
          email: payerEmail || "financeiro@lamore.com.br"
        },
        ...(applicationFee > 0 && { application_fee: applicationFee })
      })
    });

    const paymentData = await response.json();

    if (!response.ok || paymentData.status === "rejected") {
      const errorMsg = paymentData.message || paymentData.cause?.[0]?.description || "Transação recusada pelo emissor.";
      return NextResponse.json({ error: errorMsg, details: paymentData }, { status: response.ok ? 400 : response.status });
    }

    // 3. Se aprovado, incrementa o saldo do cartão na hora
    const aprovado = paymentData.status === "approved";
    if (aprovado) {
      const cartao = await prisma.cartao.findUnique({
        where: { codigo: cartaoCodigo.toUpperCase() },
        include: { cliente: true }
      });
      if (cartao) {
        const taxaPct = evento.taxaMasterPercent || 0;
        const valorTaxaMaster = (value * taxaPct) / 100;
        await prisma.$transaction([
          prisma.cartao.update({
            where: { id: cartao.id },
            data: { saldo: { increment: value } }
          }),
          prisma.movimentacao.create({
            data: {
              tipo: "RECARGA",
              valor: value,
              descricao: `Recarga Carteira Digital (${paymentMethodId.toUpperCase()})`,
              cartaoId: cartao.id,
              gatewayId: paymentData.id.toString(),
              gatewayStatus: "CONFIRMADO",
              valorTaxaMaster
            }
          })
        ]);

        // Enviar push de recarga real
        if (cartao.cliente?.pushSubscriptionJson) {
          const { enviarNotificacao } = require('@/lib/push');
          const formattedValue = value.toFixed(2).replace('.', ',');
          const formattedSaldo = (cartao.saldo + value).toFixed(2).replace('.', ',');
          enviarNotificacao(
            cartao.cliente.pushSubscriptionJson,
            'Saldo Adicionado! ⚡',
            `Recarga de R$ ${formattedValue} creditada. Novo saldo: R$ ${formattedSaldo}.`,
            `/cartao/${cartaoCodigo.toUpperCase()}`
          ).catch(console.error);
        }

        // Notificar operadores vinculados ao evento
        // Notificacao para operadores removida para evitar spam
      }
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
