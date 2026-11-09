import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logSupportAction } from '@/lib/audit';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    let eventoId = searchParams.get('eventoId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    // Strict multi-tenancy: Non-master users can ONLY access products of their assigned event
    if (session && session.user && session.user.role !== 'MASTER') {
      eventoId = session.user.eventoId;
      if (!eventoId) {
        return NextResponse.json([]);
      }
    }

    // A query for products MUST have an eventoId. Never return products from all events mixed together!
    if (!eventoId) {
      return NextResponse.json([]);
    }

    const where = {
      eventoId,
      ...(!includeInactive && { ativo: true }),
    };

    const produtosRaw = await prisma.produto.findMany({
      where,
      include: includeInactive
        ? {
            movimentacoes: {
              where: { tipo: 'HISTORICO_PRECO' },
              orderBy: { criadaEm: 'asc' },
              select: {
                id: true,
                valor: true,
                descricao: true,
                operadorNome: true,
                criadaEm: true,
              },
            },
          }
        : undefined,
      orderBy: [{ grupo: 'asc' }, { nome: 'asc' }],
    });

    const produtos = produtosRaw
      .filter((p) => {
        const isDeleted = String(p.atualizadoPorNome || '').startsWith('[EXCLUIDO]');
        if (isDeleted && !includeDeleted) return false;
        return true;
      })
      .map((p) => {
        const isDeleted = String(p.atualizadoPorNome || '').startsWith('[EXCLUIDO]');
        const cleanUpdatedBy = isDeleted
          ? String(p.atualizadoPorNome || '').replace(/^\[EXCLUIDO\]\s*/, '')
          : p.atualizadoPorNome;

        const historicoPrecos = Array.isArray(p.movimentacoes)
          ? p.movimentacoes.map((m) => {
              let parsed = null;
              try {
                parsed = JSON.parse(m.descricao || '{}');
              } catch {
                parsed = null;
              }
              return {
                id: m.id,
                de: parsed?.de ?? null,
                para: parsed?.para ?? m.valor,
                por: parsed?.por || m.operadorNome || 'Sistema',
                data: m.criadaEm,
              };
            })
          : [];

        const { movimentacoes, ...rest } = p;
        return {
          ...rest,
          excluido: isDeleted,
          atualizadoPorNome: cleanUpdatedBy,
          historicoPrecos,
        };
      });

    return NextResponse.json(produtos);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

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
        imagem: body.imagem || '📦',
        observacao: body.observacao || null,
        precoVariavel: Boolean(body.precoVariavel),
        ativo: true,
        criadoPorId: session?.user?.id,
        criadoPorNome: session?.user?.nome,
      },
    });

    await logSupportAction({
      session,
      eventoId: body.eventoId,
      acao: 'CADASTRO_PRODUTO',
      detalhes: `Cadastrou o produto "${produto.nome}" (${produto.grupo}) por R$ ${Number(produto.preco).toFixed(2)}`,
      produtoId: produto.id,
      valor: produto.preco,
    });

    return NextResponse.json(produto, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
