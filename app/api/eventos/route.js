import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const eventos = await prisma.evento.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: { select: { cartoes: true, produtos: true, usuarios: true } },
      },
    });
    return NextResponse.json(eventos);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    const body = await req.json();
    const evento = await prisma.evento.create({
      data: {
        nome: body.nome,
        data: new Date(body.data),
        local: body.local,
        taxaMasterPercent: parseFloat(body.taxaMasterPercent) || 5,
        status: 'CONFIGURANDO',
      },
    });
    return NextResponse.json(evento, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
