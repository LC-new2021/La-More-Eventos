import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const eventoId = searchParams.get('eventoId');
    const produtos = await prisma.produto.findMany({
      where: { ...(eventoId && { eventoId }), ativo: true },
      orderBy: [{ grupo: 'asc' }, { nome: 'asc' }],
    });
    return NextResponse.json(produtos);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const role = session.user?.role;
    if (!['MASTER', 'ORGANIZADOR', 'SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const produto = await prisma.produto.create({
      data: {
        nome: body.nome,
        preco: parseFloat(body.preco),
        grupo: body.grupo,
        eventoId: body.eventoId,
        imagem: body.imagem || "📦",
        observacao: body.observacao || null,
        precoVariavel: Boolean(body.precoVariavel),
        ativo: true,
        criadoPorId: session?.user?.id,
        criadoPorNome: session?.user?.nome,
      },
    });
    return NextResponse.json(produto, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
