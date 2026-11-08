import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logSupportAction } from '@/lib/audit';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { produtos, eventoId } = body;

    if (!Array.isArray(produtos) || !eventoId) {
      return NextResponse.json({ error: 'Dados inválidos. Envie uma lista de produtos e o ID do evento.' }, { status: 400 });
    }

    const created = await prisma.produto.createMany({
      data: produtos.map(p => ({
        nome: p.nome,
        preco: parseFloat(p.preco) || 0,
        grupo: p.grupo || 'Outros',
        imagem: p.imagem || '📦',
        eventoId: eventoId,
        ativo: true,
        criadoPorId: session?.user?.id || null,
        criadoPorNome: session?.user?.nome || null,
      }))
    });

    await logSupportAction({
      session,
      eventoId,
      acao: 'IMPORTACAO_PRODUTOS',
      detalhes: `Importou ${created.count} produto(s) em lote via planilha`,
    });

    return NextResponse.json({ ok: true, count: created.count }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
