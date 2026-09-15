import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { consultarPagamentoAsaas } from '@/lib/asaas';
import { consultarPagamentoMercadoPago } from '@/lib/mercadopago';
import { enviarNotificacao } from '@/lib/push';

export const dynamic = 'force-dynamic';

async function obterTokensGateway(evento) {
  let asaasToken = evento?.asaasToken || process.env.ASAAS_API_KEY;
  let mpToken = evento?.mercadoPagoAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!asaasToken || !mpToken) {
    const eventoComToken = await prisma.evento.findFirst({
      where: {
        OR: [
          { asaasToken: { not: null } },
          { mercadoPagoAccessToken: { not: null } },
        ],
      },
    });
    if (eventoComToken) {
      if (!asaasToken && eventoComToken.asaasToken) asaasToken = eventoComToken.asaasToken;
      if (!mpToken && eventoComToken.mercadoPagoAccessToken) mpToken = eventoComToken.mercadoPagoAccessToken;
    }
  }

  return { asaasToken, mpToken };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('paymentId') || searchParams.get('txid');
    const cartaoCodigo = searchParams.get('cartaoCodigo');

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId obrigatório' }, { status: 400 });
    }

    const codigoUpper = (cartaoCodigo || '').toUpperCase().trim();

    // 1. Localiza o cartão
    const cartao = await prisma.cartao.findFirst({
      where: {
        OR: [
          { codigo: codigoUpper },
          { codigo: codigoUpper.replace(/^CART-+/i, '') },
          { codigo: `CART-${codigoUpper.replace(/^CART-+/i, '')}` },
        ],
      },
      include: {
        cliente: true,
        evento: true,
        movimentacoes: {
          orderBy: { criadaEm: 'desc' },
          take: 10,
          include: { produto: { select: { nome: true } } },
        },
      },
    });

    if (!cartao) {
      return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    }

    // 2. Se já existe movimentação com este paymentId registrada como CONFIRMADO, o pagamento já foi aprovado e creditado!
    const movExistente = await prisma.movimentacao.findFirst({
      where: {
        cartaoId: cartao.id,
        gatewayId: paymentId.toString(),
      },
    });

    if (movExistente) {
      return NextResponse.json({
        success: true,
        status: 'APROVADO',
        cartao: cartao,
        novoSaldo: cartao.saldo,
      });
    }

    // 3. Consulta em tempo real na API do Banco (Gateway)
    const { asaasToken, mpToken } = await obterTokensGateway(cartao.evento);

    let pagamentoAprovado = false;
    let valorAprovado = 0;

    // Se for ID do Asaas (inicia com 'pay_') ou o evento usar Asaas
    if (paymentId.startsWith('pay_') && asaasToken) {
      const asaasData = await consultarPagamentoAsaas({ token: asaasToken, paymentId });
      if (asaasData && (asaasData.status === 'RECEIVED' || asaasData.status === 'CONFIRMED')) {
        pagamentoAprovado = true;
        valorAprovado = parseFloat(asaasData.value || 0);
      }
    }

    // Se não for Asaas, tenta Mercado Pago
    if (!pagamentoAprovado && mpToken) {
      const mpData = await consultarPagamentoMercadoPago({ token: mpToken, paymentId });
      if (mpData && mpData.status === 'approved') {
        pagamentoAprovado = true;
        valorAprovado = parseFloat(mpData.transaction_amount || 0);
      }
    }

    // 4. Se o banco confirmou o pagamento, credita o saldo atomicamente no banco de dados
    if (pagamentoAprovado && valorAprovado > 0) {
      const taxaPct = cartao.evento?.taxaMasterPercent || 0;
      const valorTaxaMaster = (valorAprovado * taxaPct) / 100;

      const [cartaoAtualizado, novaMovimentacao] = await prisma.$transaction([
        prisma.cartao.update({
          where: { id: cartao.id },
          data: {
            saldo: { increment: valorAprovado },
          },
          include: {
            cliente: true,
            evento: { select: { id: true, nome: true, status: true, mercadoPagoPublicKey: true, modoOperacao: true, permiteDevolucao: true } },
            movimentacoes: {
              orderBy: { criadaEm: 'desc' },
              take: 10,
              include: { produto: { select: { nome: true } } },
            },
          },
        }),
        prisma.movimentacao.create({
          data: {
            tipo: 'RECARGA',
            valor: valorAprovado,
            descricao: `Recarga Online PIX — ${cartao.evento?.nome || 'La More Eventos'}`,
            cartaoId: cartao.id,
            operadorNome: 'Gateway Bancário',
            gatewayId: paymentId.toString(),
            gatewayStatus: 'CONFIRMADO',
            valorTaxaMaster: valorTaxaMaster,
          },
        }),
      ]);

      // Envia notificação Web Push se o cliente tiver ativado
      if (cartaoAtualizado.cliente?.pushSubscriptionJson) {
        try {
          const valFormatado = valorAprovado.toFixed(2).replace('.', ',');
          const saldoFormatado = cartaoAtualizado.saldo.toFixed(2).replace('.', ',');
          await enviarNotificacao(
            cartaoAtualizado.cliente.pushSubscriptionJson,
            'Recarga Confirmada! ⚡',
            `Recarga de R$ ${valFormatado} aprovada pelo banco! Novo saldo: R$ ${saldoFormatado}.`,
            `/cartao/${cartaoAtualizado.codigo}`
          );
        } catch (ePush) {
          console.warn('[PUSH ERROR]:', ePush.message);
        }
      }

      console.log(`[RECARGA PIX AUTOMATICA APROVADA] Cartão ${cartao.codigo} carregado com +R$ ${valorAprovado}. Novo saldo: R$ ${cartaoAtualizado.saldo}`);

      return NextResponse.json({
        success: true,
        status: 'APROVADO',
        cartao: cartaoAtualizado,
        novoSaldo: cartaoAtualizado.saldo,
        valorRecarregado: valorAprovado,
      });
    }

    // Pagamento ainda pendente no banco
    return NextResponse.json({
      success: true,
      status: 'PENDENTE',
      message: 'Aguardando confirmação do banco.',
    });
  } catch (error) {
    console.error('[ERRO STATUS RECARGA]:', error);
    return NextResponse.json({ error: error.message || 'Erro ao consultar status' }, { status: 500 });
  }
}
