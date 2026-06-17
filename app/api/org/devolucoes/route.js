import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: session.user.id }
    });

    if (!usuario || !usuario.eventoId) {
      return NextResponse.json({ error: 'Usuário sem evento' }, { status: 400 });
    }

    const solicitacoes = await prisma.solicitacaoDevolucao.findMany({
      where: { eventoId: usuario.eventoId },
      include: {
        cartao: {
          include: { cliente: true }
        }
      },
      orderBy: [
        { status: 'asc' }, // PENDENTE vem antes de CONCLUIDA na ordem alfabética (C vem antes de P? Não, então PENDENTE desce? Vamos ordenar por data)
        { criadoEm: 'desc' }
      ]
    });

    // Forçar PENDENTE primeiro no JS
    solicitacoes.sort((a, b) => {
      if (a.status === 'PENDENTE' && b.status !== 'PENDENTE') return -1;
      if (a.status !== 'PENDENTE' && b.status === 'PENDENTE') return 1;
      return new Date(b.criadoEm) - new Date(a.criadoEm);
    });

    return NextResponse.json(solicitacoes);
  } catch (error) {
    console.error('Erro GET devolucoes:', error);
    return NextResponse.json({ error: 'Erro ao buscar' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const atualizada = await prisma.solicitacaoDevolucao.update({
      where: { id },
      data: { status }
    });

    return NextResponse.json(atualizada);
  } catch (error) {
    console.error('Erro PATCH devolucoes:', error);
    return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 });
  }
}
