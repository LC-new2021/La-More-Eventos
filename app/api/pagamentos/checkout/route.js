import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
      if (!mpToken && ev.mercadoPagoAccessToken && ev.mercadoPagoAccessToken.trim().length > 10 && ev.mercadoPagoAccessToken.trim() !== 'lamore2026') {
        mpToken = ev.mercadoPagoAccessToken.trim();
      }
    }
  }

  return { asaasToken, mpToken };
}

export async function POST(req) {
  try {
    const { codigo, valor } = await req.json();

    if (!codigo || !valor) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const valorEmCentavos = Math.round(valor * 100);

    const cartao = await prisma.cartao.findUnique({
      where: { codigo: codigo.toUpperCase() },
      include: { evento: true, cliente: true }
    });

    if (!cartao) throw new Error('Cartão não encontrado');
    if (cartao.status !== 'ATIVO') throw new Error('Cartão inativo');

    const { asaasToken, mpToken } = await obterTokensGateway(cartao.evento);
    const gateway = (cartao.evento.gatewayActive || 'ASAAS').toUpperCase();
    
    // Obter o host atual dinamicamente para garantir a URL correta
    const host = req.headers.get('host') || 'la-more-eventos-production.up.railway.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const successUrl = `${baseUrl}/cartao/${cartao.codigo}?sucesso=true`;
    const failureUrl = `${baseUrl}/cartao/${cartao.codigo}`;

    // STONE (Pagar.me)
    if (gateway === 'STONE') {
      const sk = cartao.evento.stoneToken || cartao.evento.stoneSecretKey;
      if (!sk) throw new Error('Chave secreta da Stone não configurada.');

      const payload = {
        customer: {
          name: cartao.cliente.nome || 'Cliente Local',
          email: cartao.cliente.email || 'financeiro@grupolamore.com.br',
          type: 'individual',
          document: cartao.cliente.cpf || '00000000000'
        },
        items: [
          {
            amount: valorEmCentavos,
            description: `Recarga Cartão ${cartao.codigo}`,
            quantity: 1,
            code: `REC_${cartao.codigo}`
          }
        ],
        checkouts: [
          {
            payment_methods: ["credit_card", "debit_card"],
            success_url: successUrl,
            skip_checkout_success_page: true,
            customer_editable: false
          }
        ],
        closed: true
      };

      const chaveBase64 = Buffer.from(`${sk}:`).toString('base64');
      const response = await fetch('https://api.pagar.me/core/v5/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${chaveBase64}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erro na Stone');

      return NextResponse.json({ url: data.checkouts[0].payment_url });
    }

    // PAGBANK
    if (gateway === 'PAGBANK') {
      const token = cartao.evento.pagbankToken;
      if (!token) throw new Error('Token PagBank ausente');
      
      const isSandbox = token.includes('SANDBOX');
      const apiUrl = isSandbox ? "https://sandbox.api.pagseguro.com/checkouts" : "https://api.pagseguro.com/checkouts";
      
      const payload = {
        reference_id: `REC_${cartao.codigo}_${Date.now()}`,
        customer: {
          name: cartao.cliente.nome || "Cliente Lamore",
          email: "financeiro@grupolamore.com.br",
          tax_id: cartao.cliente.cpf ? cartao.cliente.cpf.replace(/\D/g, "") : "00000000000"
        },
        items: [{
          name: `Recarga Cartão ${cartao.codigo}`,
          quantity: 1,
          unit_amount: valorEmCentavos
        }],
        redirect_url: successUrl
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Erro ao criar checkout PagBank');
      
      const paymentUrl = data.links?.find(l => l.rel === 'PAY')?.href;
      return NextResponse.json({ url: paymentUrl || data.links[0].href });
    }

    // ASAAS
    if (gateway === 'ASAAS' && asaasToken) {
      const isSandbox = asaasToken.startsWith('$aact_sandbox_') || asaasToken.startsWith('$aae.');
      const asaasUrl = isSandbox ? "https://sandbox.asaas.com/api" : "https://api.asaas.com";

      const payload = {
        name: `Recarga Cartão ${cartao.codigo}`,
        description: `Recarga Cartão ${cartao.codigo} - ${cartao.evento.nome}`,
        value: Number(valor),
        billingType: "CREDIT_CARD", // Somente Cartão de Crédito (sem Boleto e sem Pix duplicado)
        chargeType: "DETACHED",
        maxInstallmentCount: 1,
        dueDateLimitDays: 1,
        externalReference: cartao.codigo,
      };

      const res = await fetch(`${asaasUrl}/v3/paymentLinks`, {
        method: 'POST',
        headers: { 'access_token': asaasToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.description || 'Erro Asaas');

      return NextResponse.json({ url: data.url });
    }

    // MERCADO PAGO (ou Fallback se Asaas não configurado)
    if ((gateway === 'MERCADO_PAGO' || mpToken) && mpToken) {
      const mpPayload = {
        items: [
          {
            title: `Recarga Cartão ${cartao.codigo}`,
            description: "Recarga de Saldo - Carteira Digital La More",
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(valor)
          }
        ],
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: failureUrl
        },
        auto_return: "approved",
        external_reference: cartao.codigo,
        payment_methods: {
          excluded_payment_types: [
            { id: "ticket" },
            { id: "atm" },
            { id: "bank_transfer" }
          ],
          installments: 1
        }
      };

      const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mpPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao gerar checkout no Mercado Pago');

      return NextResponse.json({ url: data.init_point });
    }

    throw new Error('Gateway de pagamento não configurado para este evento.');

  } catch (error) {
    console.error('Erro /api/pagamentos/checkout:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
