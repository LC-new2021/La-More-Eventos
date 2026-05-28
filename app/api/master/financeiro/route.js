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

    // Get all events
    const eventos = await prisma.evento.findMany({
      include: {
        cartoes: {
          include: {
            movimentacoes: true
          }
        }
      }
    });

    let totalRecarregadoGlobal = 0;
    let totalTaxaMasterGlobal = 0;
    const eventosDetalhados = [];

    for (const ev of eventos) {
      let recarregado = 0;
      let taxaMaster = 0;

      for (const card of ev.cartoes) {
        for (const mov of card.movimentacoes) {
          if (mov.tipo === 'RECARGA') {
            recarregado += mov.valor;
          }
        }
      }

      taxaMaster = (recarregado * (ev.taxaMasterPercent || 0)) / 100;

      totalRecarregadoGlobal += recarregado;
      totalTaxaMasterGlobal += taxaMaster;

      eventosDetalhados.push({
        id: ev.id,
        nome: ev.nome,
        status: ev.status,
        taxaMasterPercent: ev.taxaMasterPercent || 0,
        totalRecarregado: recarregado,
        totalTaxaMaster: taxaMaster,
      });
    }

    return NextResponse.json({
      totalRecarregadoGlobal,
      totalTaxaMasterGlobal,
      eventos: eventosDetalhados
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
