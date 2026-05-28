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

export async function POST(req) {
  try {
    const body = await req.json();
    const produto = await prisma.produto.create({
      data: {
        nome: body.nome,
        preco: parseFloat(body.preco),
        grupo: body.grupo,
        eventoId: body.eventoId,
        ativo: true,
      },
    });
    return NextResponse.json(produto, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
