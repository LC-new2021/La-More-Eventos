import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const body = await req.json();
    const produto = await prisma.produto.update({
      where: { id },
      data: {
        ...body,
        atualizadoPorNome: session?.user?.nome
      },
    });
    return NextResponse.json(produto);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    await prisma.produto.update({
      where: { id },
      data: { ativo: false },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
