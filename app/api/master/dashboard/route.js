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

    // Get active events count
    const eventosAtivos = await prisma.evento.count({ where: { status: 'ATIVO' } });
    
    // Get total cards
    const cartoesEmitidos = await prisma.cartao.count();

    // Get all events with their recargas to calculate dynamic totals
    const eventos = await prisma.evento.findMany({
      include: {
        cartoes: {
          include: {
            movimentacoes: {
              where: { tipo: 'RECARGA' },
              select: { valor: true }
            }
          }
        }
      }
    });

    let totalRecarregado = 0;
    let taxaLaMore = 0;

    for (const ev of eventos) {
      let recarregadoEvento = 0;
      for (const card of ev.cartoes) {
        for (const mov of card.movimentacoes) {
          recarregadoEvento += mov.valor;
        }
      }
      totalRecarregado += recarregadoEvento;
      taxaLaMore += (recarregadoEvento * (ev.taxaMasterPercent || 0)) / 100;
    }

    return NextResponse.json({
      eventosAtivos,
      cartoesEmitidos,
      totalRecarregado,
      taxaLaMore
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
