import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const eventoId = searchParams.get('eventoId');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    const where = {};
    if (eventoId) {
      where.OR = [
        { cartao: { eventoId } },
        { gatewayStatus: eventoId },
        { produto: { eventoId } },
        { operador: { eventoId } },
      ];
    }

    if (dataInicio || dataFim) {
      where.criadaEm = {};
      if (dataInicio) {
        const start = new Date(`${dataInicio}T00:00:00-03:00`);
        where.criadaEm.gte = start;
      }
      if (dataFim) {
        const end = new Date(`${dataFim}T23:59:59.999-03:00`);
        where.criadaEm.lte = end;
      }
    }

    const [movimentacoes, eventos] = await Promise.all([
      prisma.movimentacao.findMany({
        where,
        include: {
          cartao: {
            include: {
              cliente: true,
              evento: { select: { id: true, nome: true } },
            },
          },
          produto: {
            select: { id: true, nome: true, grupo: true, preco: true, eventoId: true },
          },
          operador: {
            select: { id: true, nome: true, role: true, eventoId: true },
          },
        },
        orderBy: { criadaEm: 'desc' },
        take: 20000,
      }),
      prisma.evento.findMany({ select: { id: true, nome: true } }),
    ]);

    const eventosMap = Object.fromEntries(eventos.map((e) => [e.id, e.nome]));

    const enriched = movimentacoes.map((m) => {
      const resolvedEventoId =
        m.cartao?.evento?.id ||
        m.produto?.eventoId ||
        (m.gatewayStatus && eventosMap[m.gatewayStatus] ? m.gatewayStatus : null) ||
        m.operador?.eventoId ||
        null;

      const resolvedEventoNome =
        m.cartao?.evento?.nome || (resolvedEventoId ? eventosMap[resolvedEventoId] : null) || 'Geral';

      return {
        ...m,
        eventoNome: resolvedEventoNome,
      };
    });

    return NextResponse.json(enriched);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
