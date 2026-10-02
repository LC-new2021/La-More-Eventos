import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    const body = await req.json();

    const role = session.user?.role;
    const isSupport = role === 'SUPORTE_OPERACIONAL' || role === 'CLIENTE' || role === 'SUPORTE';

    if (isSupport && body.preco !== undefined) {
      const existing = await prisma.produto.findUnique({ where: { id } });
      if (existing && Number(existing.preco) !== Number(body.preco)) {
        return NextResponse.json({
          error: 'O perfil Suporte Operacional não possui permissão para alterar o preço de produtos existentes. Cadastre um novo produto com o preço promocional.'
        }, { status: 403 });
      }
    }

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
    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    await prisma.produto.update({
      where: { id },
      data: { ativo: false },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
