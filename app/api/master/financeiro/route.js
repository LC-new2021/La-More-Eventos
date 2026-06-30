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

    // Build query filters for movimentacoes
    const movFilters = { tipo: 'RECARGA' };
    if (dataInicio && dataFim) {
      movFilters.criadaEm = {
        gte: new Date(`${dataInicio}T00:00:00.000Z`),
        lte: new Date(`${dataFim}T23:59:59.999Z`)
      };
    } else if (dataInicio) {
      movFilters.criadaEm = { gte: new Date(`${dataInicio}T00:00:00.000Z`) };
    } else if (dataFim) {
      movFilters.criadaEm = { lte: new Date(`${dataFim}T23:59:59.999Z`) };
    }

    const eventosQuery = {
      include: {
        cartoes: {
          include: {
            movimentacoes: {
              where: movFilters
            }
          }
        }
      }
    };

    if (eventoId) {
      eventosQuery.where = { id: eventoId };
    }

    const eventos = await prisma.evento.findMany(eventosQuery);

    let totalRecarregadoGlobal = 0;
    let totalTaxaMasterGlobal = 0;
    const eventosDetalhados = [];

    for (const ev of eventos) {
      let recarregado = 0;
      let taxaMaster = 0;

      for (const card of ev.cartoes) {
        for (const mov of card.movimentacoes) {
          recarregado += mov.valor;
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
