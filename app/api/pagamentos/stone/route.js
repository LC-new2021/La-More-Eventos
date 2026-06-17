import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cria um pedido na Stone (Pagar.me API v5)
export async function POST(req) {
  try {
    const { codigo, valor, metodoPagamento, cardData } = await req.json();

    if (!codigo || !valor || !metodoPagamento) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const valorEmCentavos = Math.round(valor * 100);

    const cartao = await prisma.cartao.findUnique({
      where: { codigo: codigo.toUpperCase() },
      include: { evento: true, cliente: true }
    });

    if (!cartao) throw new Error('Cartão não encontrado');
    if (cartao.status !== 'ATIVO') throw new Error('Cartão inativo');

    const sk = cartao.evento.stoneSecretKey;
    if (!sk) {
      throw new Error('Chave secreta da Stone não configurada para este evento.');
    }

    // Monta o payload básico da Pagar.me
    const payload = {
      customer: {
        name: cartao.cliente.nome || 'Cliente Local',
        email: cartao.cliente.email || 'cliente@bilheteria.com.br',
        type: 'individual',
        document: cartao.cliente.cpf || '00000000000', // Pagar.me exige um documento válido em prod
        phones: {
          mobile_phone: {
            country_code: '55',
            area_code: '11',
            number: '999999999'
          }
        }
      },
      items: [
        {
          amount: valorEmCentavos,
          description: `Recarga Cartão ${cartao.codigo}`,
          quantity: 1,
          code: `REC_${cartao.codigo}`
        }
      ],
      closed: true, // Fecha o pedido automaticamente
    };

    if (metodoPagamento === 'PIX') {
      payload.payments = [
        {
          payment_method: 'pix',
          pix: {
            expires_in: 3600 // 1 hora
          }
        }
      ];
    } else if (metodoPagamento === 'CREDIT_CARD') {
      if (!cardData) throw new Error('Dados do cartão são obrigatórios');
      
      payload.payments = [
        {
          payment_method: 'credit_card',
          credit_card: {
            installments: 1,
            statement_descriptor: 'LAMORE',
            card: {
              number: cardData.numero,
              holder_name: cardData.titular,
              exp_month: parseInt(cardData.mes),
              exp_year: parseInt(cardData.ano),
              cvv: cardData.cvv
            }
          }
        }
      ];
    } else {
      throw new Error('Método de pagamento inválido para a Stone.');
    }

    // Faz a chamada para a Pagar.me
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

    if (!response.ok) {
      console.error('Erro Stone:', data);
      throw new Error(data.message || 'Erro ao processar pagamento na Stone.');
    }

    // Registra a transação pendente no nosso banco
    const movimentacao = await prisma.movimentacao.create({
      data: {
        tipo: 'RECARGA_PENDENTE',
        valor: parseFloat(valor),
        descricao: `Recarga Online (Stone ${metodoPagamento})`,
        cartaoId: cartao.id,
        gatewayId: data.id,
        gatewayStatus: data.status
      }
    });

    // Se for PIX, retorna o QR Code
    if (metodoPagamento === 'PIX') {
      const qrCodeUrl = data.charges[0].last_transaction.qr_code_url;
      const qrCodeStr = data.charges[0].last_transaction.qr_code;
      
      return NextResponse.json({
        success: true,
        movimentacaoId: movimentacao.id,
        orderId: data.id,
        pix: {
          qrCodeUrl,
          qrCodeStr
        }
      });
    }

    // Se for cartão e aprovar direto
    if (data.status === 'paid') {
      // Já efetiva o saldo
      await prisma.$transaction([
        prisma.movimentacao.update({
          where: { id: movimentacao.id },
          data: { tipo: 'RECARGA', gatewayStatus: 'paid' }
        }),
        prisma.cartao.update({
          where: { id: cartao.id },
          data: { saldo: { increment: parseFloat(valor) } }
        })
      ]);
      return NextResponse.json({ success: true, status: 'PAID' });
    }

    return NextResponse.json({ success: true, status: data.status });

  } catch (error) {
    console.error('Erro /pagamentos/stone:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
