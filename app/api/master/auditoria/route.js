import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const movimentacoes = await prisma.movimentacao.findMany({
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
      take: 50
    });

    return NextResponse.json(movimentacoes);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
