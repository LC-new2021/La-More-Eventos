import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req, { params }) {
  try {
    const { codigo } = await params;
    const cartao = await prisma.cartao.findUnique({
      where: { codigo: codigo.toUpperCase() },
      include: {
        cliente: true,
        evento: { select: { id: true, nome: true, status: true, mercadoPagoPublicKey: true } },
        movimentacoes: {
          orderBy: { criadaEm: 'desc' },
          take: 10,
          include: { produto: { select: { nome: true } } },
        },
      },
    });
    if (!cartao) return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    return NextResponse.json(cartao);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
