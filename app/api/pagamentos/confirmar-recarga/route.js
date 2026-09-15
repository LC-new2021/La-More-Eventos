import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { cartaoCodigo, valor, eventoId, txid } = body;

    if (!cartaoCodigo) {
      return NextResponse.json({ error: 'Código do cartão obrigatório' }, { status: 400 });
    }

    const valorFloat = parseFloat(valor || 0);
    if (isNaN(valorFloat) || valorFloat <= 0) {
      return NextResponse.json({ error: 'Valor de recarga inválido' }, { status: 400 });
    }

    const codigoUpper = cartaoCodigo.toUpperCase().trim();

    // 1. Localiza o cartão no banco
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
        evento: { select: { id: true, nome: true, status: true, mercadoPagoPublicKey: true, modoOperacao: true, permiteDevolucao: true } },
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

    // 2. Previne duplicação caso a mesma transação / txid já tenha sido confirmada nos últimos minutos
    const idTransacao = txid || `RECARGA_PIX_${cartao.codigo}_${Date.now()}`;
    const movExistente = await prisma.movimentacao.findFirst({
      where: {
        cartaoId: cartao.id,
        gatewayId: idTransacao,
      },
    });

    if (movExistente) {
      return NextResponse.json({
        success: true,
        mensagem: 'Recarga já confirmada anteriormente',
        cartao: {
          ...cartao,
          saldo: cartao.saldo,
        },
        novoSaldo: cartao.saldo,
      });
    }

    // 3. Atualiza o saldo do cartão e registra a movimentação
    const [cartaoAtualizado, novaMovimentacao] = await prisma.$transaction([
      prisma.cartao.update({
        where: { id: cartao.id },
        data: {
          saldo: { increment: valorFloat },
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
          valor: valorFloat,
          descricao: `Recarga Online PIX — ${cartao.evento?.nome || 'La More Eventos'}`,
          cartaoId: cartao.id,
          operadorNome: 'PIX Direto Online',
          gatewayId: idTransacao,
          gatewayStatus: 'CONFIRMADO',
          valorTaxaMaster: 0,
        },
      }),
    ]);

    console.log(`[RECARGA PIX DIRETO CONFIRMADA] Cartão ${cartao.codigo} carregado com +R$ ${valorFloat}. Novo saldo: R$ ${cartaoAtualizado.saldo}`);

    return NextResponse.json({
      success: true,
      mensagem: `Recarga de R$ ${valorFloat.toFixed(2).replace('.', ',')} creditada com sucesso!`,
      cartao: cartaoAtualizado,
      novoSaldo: cartaoAtualizado.saldo,
      valorRecarregado: valorFloat,
    });
  } catch (error) {
    console.error('[ERRO CONFIRMAR RECARGA PIX]:', error);
    return NextResponse.json({ error: error.message || 'Erro ao creditar recarga' }, { status: 500 });
  }
}
