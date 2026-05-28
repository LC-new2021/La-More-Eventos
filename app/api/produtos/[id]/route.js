import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const produto = await prisma.produto.update({
      where: { id },
      data: body,
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
