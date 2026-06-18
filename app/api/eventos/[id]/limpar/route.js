import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Acesso negado. Apenas o Master pode realizar a limpeza em massa.' }, { status: 403 });
    }

    const { id } = await params;

    const evento = await prisma.evento.findUnique({ where: { id } });
    if (!evento) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    // Apagar Cartões do evento
    const deletedCartoes = await prisma.cartao.deleteMany({
      where: { eventoId: id },
    });

    // Apagar Operadores (CAIXA, OPERADOR_BAR, TESOURARIA)
    const deletedOperadores = await prisma.usuario.deleteMany({
      where: {
        eventoId: id,
        role: {
          in: ['CAIXA', 'OPERADOR_BAR', 'TESOURARIA'],
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'Limpeza concluída com sucesso',
      cartoesDeletados: deletedCartoes.count,
      operadoresDeletados: deletedOperadores.count,
    });
  } catch (e) {
    console.error('Erro ao limpar evento:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
