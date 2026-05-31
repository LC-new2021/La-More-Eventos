import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req) {
  try {
    const body = await req.json();
    const { produtos, eventoId } = body;

    if (!Array.isArray(produtos) || !eventoId) {
      return NextResponse.json({ error: 'Dados inválidos. Envie uma lista de produtos e o ID do evento.' }, { status: 400 });
    }

    // Criação em lote (bulk) no Prisma
    const created = await prisma.produto.createMany({
      data: produtos.map(p => ({
        nome: p.nome,
        preco: parseFloat(p.preco) || 0,
        grupo: p.grupo || 'Outros',
        imagem: p.imagem || '📦',
        eventoId: eventoId,
        ativo: true
      }))
    });

    return NextResponse.json({ ok: true, count: created.count }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
