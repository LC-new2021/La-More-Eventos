import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const eventoId = session?.user?.eventoId;
    if (!eventoId) return NextResponse.json({ error: 'Sem evento' }, { status: 400 });

    const [cartoes, movimentacoes, produtos] = await Promise.all([
      prisma.cartao.findMany({ where: { eventoId } }),
      prisma.movimentacao.findMany({
        where: { cartao: { eventoId } },
        include: { cartao: { include: { cliente: true } }, produto: true, operador: true },
        orderBy: { criadaEm: 'desc' },
        take: 50,
      }),
      prisma.produto.findMany({ where: { eventoId, ativo: true } }),
    ]);

    const totalRecarregado = movimentacoes.filter(m => m.tipo === 'RECARGA').reduce((s, m) => s + m.valor, 0);
    const totalDebitos = movimentacoes.filter(m => m.tipo === 'DEBITO').reduce((s, m) => s + m.valor, 0);
    const saldoEmAberto = cartoes.reduce((s, c) => s + c.saldo, 0);

    // Ranking de produtos
    const rankingMap = {};
    for (const m of movimentacoes.filter(m => m.tipo === 'DEBITO' && m.produto)) {
      const key = m.produto.id;
      if (!rankingMap[key]) rankingMap[key] = { nome: m.produto.nome, qtd: 0, total: 0 };
      rankingMap[key].qtd++;
      rankingMap[key].total += m.valor;
    }
    const ranking = Object.values(rankingMap).sort((a, b) => b.qtd - a.qtd).slice(0, 5);

    return NextResponse.json({
      totalRecarregado,
      totalDebitos,
      saldoEmAberto,
      cartoesAtivos: cartoes.filter(c => c.status === 'ATIVO').length,
      totalPedidos: movimentacoes.filter(m => m.tipo === 'DEBITO').length,
      movimentacoes: movimentacoes.slice(0, 20),
      ranking,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
