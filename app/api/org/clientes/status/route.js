import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'ORG' && session.user.role !== 'MASTER')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { eventoId, cartaoId, status } = await req.json();

    if (!eventoId || !status) {
      return NextResponse.json({ error: 'eventoId e status são obrigatórios' }, { status: 400 });
    }

    // Segurança: se for ORG, verificar se ele tem acesso a esse evento
    if (session.user.role === 'ORG') {
      if (session.user.eventoId !== eventoId) {
        return NextResponse.json({ error: 'Acesso negado a este evento' }, { status: 403 });
      }
    }

    if (cartaoId) {
      // Atualiza apenas um cartão
      const updated = await prisma.cartao.updateMany({
        where: { id: cartaoId, eventoId },
        data: { status }
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: 'Cartão não encontrado neste evento' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Cartão atualizado' });
    } else {
      // Atualiza todos os cartões do evento
      const updated = await prisma.cartao.updateMany({
        where: { eventoId },
        data: { status }
      });
      return NextResponse.json({ success: true, message: `${updated.count} cartões atualizados` });
    }
  } catch (error) {
    console.error('Erro ao atualizar status dos cartões:', error);
    return NextResponse.json({ error: 'Erro interno ao processar solicitação' }, { status: 500 });
  }
}
