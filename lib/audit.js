import prisma from '@/lib/prisma';

export function isSupportRole(role) {
  return role === 'SUPORTE_OPERACIONAL' || role === 'CLIENTE' || role === 'SUPORTE';
}

export async function logSupportAction({ session, eventoId, acao, detalhes, produtoId = null, valor = 0 }) {
  try {
    if (!session?.user) return;
    const role = session.user.role;
    if (!isSupportRole(role)) return;

    await prisma.movimentacao.create({
      data: {
        tipo: 'AUDITORIA_SUPORTE',
        valor: Number(valor) || 0,
        descricao: `[${acao}] ${detalhes}`,
        operadorId: session.user.id || null,
        operadorNome: session.user.nome || session.user.email || 'Suporte Operacional',
        produtoId: produtoId || null,
        gatewayStatus: eventoId || session.user.eventoId || null,
      },
    });
  } catch (err) {
    console.error('Erro ao registrar auditoria de suporte operacional:', err);
  }
}

export async function logPriceChange({ session, produto, precoAntigo, precoNovo }) {
  try {
    if (!produto?.id) return;
    const oldVal = Number(precoAntigo || 0);
    const newVal = Number(precoNovo || 0);
    if (Math.abs(oldVal - newVal) < 0.001) return;

    const payload = {
      de: oldVal,
      para: newVal,
      por: session?.user?.nome || session?.user?.email || 'Sistema',
      role: session?.user?.role || 'MASTER',
    };

    await prisma.movimentacao.create({
      data: {
        tipo: 'HISTORICO_PRECO',
        valor: newVal,
        descricao: JSON.stringify(payload),
        operadorId: session?.user?.id || null,
        operadorNome: session?.user?.nome || 'Sistema',
        produtoId: produto.id,
        gatewayStatus: produto.eventoId || null,
      },
    });
  } catch (err) {
    console.error('Erro ao registrar histórico de preço:', err);
  }
}
