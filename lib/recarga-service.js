import prisma from './prisma.js';
import { enviarNotificacao } from './push.js';

/**
 * Localiza um cartão por código ou ID, tratando variações de prefixo
 */
export async function buscarCartao(codigoOuId) {
  if (!codigoOuId) return null;
  const raw = String(codigoOuId).trim();
  const rawUpper = raw.toUpperCase();
  const codigoLimpo = rawUpper.replace(/^CART-+/i, '').replace(/[^A-Za-z0-9]/g, '');

  return await prisma.cartao.findFirst({
    where: {
      OR: [
        { id: raw },
        { codigo: rawUpper },
        { codigo: raw },
        { codigo: `CART-${codigoLimpo}` },
        { codigo: `CART--${codigoLimpo}` },
        { codigo: codigoLimpo },
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
}

/**
 * Processador Idempotente e Atômico de Recargas.
 * Garante que cada transação bancária (identificada por gatewayId / paymentId / txid)
 * seja creditada UMA ÚNICA VEZ no saldo do cartão, prevenindo duplicidades mesmo
 * em caso de concorrência entre Webhook e Polling em tempo real.
 */
export async function processarRecargaIdempotente({
  cartaoId,
  cartaoCodigo,
  valor,
  gatewayId,
  gatewayStatus = 'CONFIRMADO',
  descricao,
  operadorNome = 'Gateway Bancário',
  operadorId = null,
  valorTaxaMaster = null,
}) {
  const valorNum = parseFloat(valor);
  if (!valorNum || valorNum <= 0) {
    throw new Error('Valor de recarga inválido');
  }

  // 1. Localiza o cartão
  let cartao = null;
  if (cartaoId) {
    cartao = await prisma.cartao.findUnique({
      where: { id: cartaoId },
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
  }
  if (!cartao && cartaoCodigo) {
    cartao = await buscarCartao(cartaoCodigo);
  }

  if (!cartao) {
    throw new Error(`Cartão não encontrado: ${cartaoCodigo || cartaoId}`);
  }

  const strGatewayId = gatewayId ? String(gatewayId).trim() : null;

  // 2. Verificação Prévia de Idempotência por gatewayId
  if (strGatewayId) {
    const movExistente = await prisma.movimentacao.findFirst({
      where: { gatewayId: strGatewayId },
    });

    if (movExistente) {
      console.log(`[IDEMPOTENCIA] Pagamento ${strGatewayId} já creditado anteriormente para o cartão ${cartao.codigo}. Bloqueando duplicação.`);
      const cartaoAtual = await prisma.cartao.findUnique({
        where: { id: cartao.id },
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
      return {
        sucesso: true,
        jaProcessado: true,
        cartao: cartaoAtual,
        novoSaldo: cartaoAtual.saldo,
        movimentacao: movExistente,
      };
    }
  }

  // 3. Cálculo da taxa master
  const taxaPct = cartao.evento?.taxaMasterPercent || 0;
  const taxaCalculada = valorTaxaMaster !== null ? valorTaxaMaster : (valorNum * taxaPct) / 100;

  // 4. Execução Atômica no Banco de Dados
  try {
    const [cartaoAtualizado, novaMovimentacao] = await prisma.$transaction([
      prisma.cartao.update({
        where: { id: cartao.id },
        data: {
          saldo: { increment: valorNum },
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
          valor: valorNum,
          descricao: descricao || `Recarga Online PIX — ${cartao.evento?.nome || 'La More Eventos'}`,
          cartaoId: cartao.id,
          operadorId: operadorId || null,
          operadorNome: operadorNome,
          gatewayId: strGatewayId,
          gatewayStatus: gatewayStatus,
          valorTaxaMaster: taxaCalculada,
        },
      }),
    ]);

    // 5. Envia Notificação Web Push apenas uma única vez no momento da aprovação
    if (cartaoAtualizado.cliente?.pushSubscriptionJson) {
      try {
        const valFormatado = valorNum.toFixed(2).replace('.', ',');
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

    console.log(`[RECARGA APROVADA COM SUCESSO] Cartão ${cartao.codigo} +R$ ${valorNum} (Gateway: ${strGatewayId || 'N/A'}). Novo saldo: R$ ${cartaoAtualizado.saldo}`);

    return {
      sucesso: true,
      jaProcessado: false,
      cartao: cartaoAtualizado,
      novoSaldo: cartaoAtualizado.saldo,
      movimentacao: novaMovimentacao,
    };
  } catch (err) {
    // Caso de concorrência extrema: a constraint UNIQUE(gatewayId) barrou o insert simultâneo
    if (err.code === 'P2002' || (err.message && err.message.includes('Unique constraint'))) {
      console.warn(`[IDEMPOTENCIA RACE-CONDITION BARRADA] gatewayId ${strGatewayId} já inserido concorrentemente.`);
      const cartaoAtual = await prisma.cartao.findUnique({
        where: { id: cartao.id },
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
      return {
        sucesso: true,
        jaProcessado: true,
        cartao: cartaoAtual,
        novoSaldo: cartaoAtual.saldo,
      };
    }
    throw err;
  }
}
