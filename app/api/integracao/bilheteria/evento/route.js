import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { secret, bilheteriaEventoId, nome, data, local } = body;

    const expectedSecret = process.env.LAMORE_INTEGRATION_SECRET || 'lamore_sec_360_integracao_bilheteria_eventos_2026';
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Token de integração inválido' }, { status: 401 });
    }

    if (!nome) {
      return NextResponse.json({ error: 'Nome do evento é obrigatório' }, { status: 400 });
    }

    const nomeClean = nome.trim();

    // 1. Procura se já existe por bilheteriaEventoId ou nome idêntico
    let evento = null;
    if (bilheteriaEventoId) {
      evento = await prisma.evento.findFirst({ where: { bilheteriaEventoId } });
    }
    if (!evento) {
      evento = await prisma.evento.findFirst({
        where: {
          nome: { equals: nomeClean }
        }
      });
    }

    // 2. Se não existir, cria o evento oficial na LaMore Eventos
    if (!evento) {
      evento = await prisma.evento.create({
        data: {
          nome: nomeClean,
          bilheteriaEventoId: bilheteriaEventoId || null,
          data: data ? new Date(data) : new Date(),
          local: local || 'A Definir',
          status: 'ATIVO',
          modoOperacao: 'GERENCIAL',
          taxaMasterPercent: 8,
          gatewayActive: 'ASAAS',
        },
      });
      console.log(`[INTEGRAÇÃO] Evento criado no LaMore Eventos: '${evento.nome}' (ID: ${evento.id})`);
    } else if (bilheteriaEventoId && evento.bilheteriaEventoId !== bilheteriaEventoId) {
      evento = await prisma.evento.update({
        where: { id: evento.id },
        data: { bilheteriaEventoId },
      });
    }

    return NextResponse.json({
      success: true,
      evento: {
        id: evento.id,
        nome: evento.nome,
        status: evento.status,
        local: evento.local,
        bilheteriaEventoId: evento.bilheteriaEventoId,
      },
    });
  } catch (error) {
    console.error('Erro ao integrar evento da bilheteria:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
