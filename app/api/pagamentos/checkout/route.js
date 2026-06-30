import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

    const gateway = cartao.evento.gatewayActive || 'ASAAS';
    
    // Obter o host atual dinamicamente para garantir a URL correta (Railway)
    const host = req.headers.get('host') || 'la-more-eventos-production.up.railway.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const successUrl = `${baseUrl}/cartao/${cartao.codigo}?sucesso=true`;
    const failureUrl = `${baseUrl}/cartao/${cartao.codigo}`;

    // STONE (Pagar.me)
    if (gateway === 'STONE') {
      const sk = cartao.evento.stoneSecretKey;
      if (!sk) throw new Error('Chave secreta da Stone não configurada.');

      const payload = {
        customer: {
          name: cartao.cliente.nome || 'Cliente Local',
          email: cartao.cliente.email || 'financeiro@lamore.com.br',
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
            payment_methods: ["credit_card", "pix"],
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

      // A Stone retorna o link de checkout dentro de checkouts[0].payment_url
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
          email: "financeiro@lamore.com.br",
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
    if (gateway === 'ASAAS') {
      const token = cartao.evento.asaasToken || process.env.ASAAS_API_KEY;
      if (!token) throw new Error('Token Asaas ausente');
      const isSandbox = token.startsWith('$aact_sandbox_') || token.startsWith('$aae.');
      const asaasUrl = isSandbox ? "https://sandbox.asaas.com/api" : "https://api.asaas.com";

      const payload = {
        name: `Recarga Cartão ${cartao.codigo}`,
        description: `Recarga rápida`,
        value: valor,
        billingType: "UNDEFINED", // Deixa o cliente escolher Cartão, Pix etc
        chargeType: "DETACHED",
        dueDateLimitDays: 1
      };

      const res = await fetch(`${asaasUrl}/v3/paymentLinks`, {
        method: 'POST',
        headers: { 'access_token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.description || 'Erro Asaas');

      return NextResponse.json({ url: data.url });
    }

    // MERCADO PAGO
    if (gateway === 'MERCADO_PAGO') {
      const token = cartao.evento.mercadoPagoAccessToken;
      if (!token) throw new Error('Access Token do Mercado Pago ausente.');

      const mpPayload = {
        items: [
          {
            title: `Recarga Cartão ${cartao.codigo}`,
            description: "Recarga de Saldo - Carteira Digital",
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
            { id: "bank_transfer" }
          ],
          excluded_payment_methods: [
            { id: "pix" },
            { id: "bolbanc" },
            { id: "pec" }
          ],
          installments: 12
        }
      };

      const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mpPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao gerar checkout no Mercado Pago');

      return NextResponse.json({ url: data.init_point });
    }

    throw new Error('Gateway inválido');

  } catch (error) {
    console.error('Erro /api/pagamentos/checkout:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
