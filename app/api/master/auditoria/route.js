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
      where.cartao = { eventoId };
    }
    
    if (dataInicio || dataFim) {
      where.criadaEm = {};
      if (dataInicio) {
        const start = new Date(dataInicio);
        start.setUTCHours(0,0,0,0);
        where.criadaEm.gte = start;
      }
      if (dataFim) {
        const end = new Date(dataFim);
        end.setUTCHours(23,59,59,999);
        where.criadaEm.lte = end;
      }
    }

    const movimentacoes = await prisma.movimentacao.findMany({
      where,
      include: {
        cartao: {
          include: {
            cliente: { select: { nome: true } },
            evento: { select: { nome: true } }
          }
        },
        operador: { select: { nome: true, role: true } }
      },
      orderBy: { criadaEm: 'desc' },
      take: (dataInicio || dataFim) ? 1000 : 50
    });

    return NextResponse.json(movimentacoes);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
