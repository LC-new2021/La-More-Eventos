import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isSupportRole, logSupportAction, logPriceChange } from '@/lib/audit';

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
    const isSupport = isSupportRole(role);

    const existing = await prisma.produto.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    if (isSupport) {
      // Suporte Operacional pode apenas ativar/desativar produtos existentes, não editar dados/preço
      const keys = Object.keys(body);
      const isOnlyToggleAtivo = keys.length === 1 && keys[0] === 'ativo';
      if (!isOnlyToggleAtivo) {
        return NextResponse.json(
          {
            error:
              'O perfil Suporte Operacional não possui permissão para editar produtos existentes (apenas ativar ou desativar).',
          },
          { status: 403 }
        );
      }
    }

    const precoMudou =
      body.preco !== undefined && Math.abs(Number(existing.preco) - Number(body.preco)) >= 0.005;

    const cleanPreviousUpdater = String(existing.atualizadoPorNome || '').replace(/^\[EXCLUIDO\]\s*/, '');

    const produto = await prisma.produto.update({
      where: { id },
      data: {
        ...(body.nome !== undefined && { nome: body.nome }),
        ...(body.preco !== undefined && { preco: parseFloat(body.preco) }),
        ...(body.grupo !== undefined && { grupo: body.grupo }),
        ...(body.imagem !== undefined && { imagem: body.imagem }),
        ...(body.observacao !== undefined && { observacao: body.observacao }),
        ...(body.precoVariavel !== undefined && { precoVariavel: Boolean(body.precoVariavel) }),
        ...(body.ativo !== undefined && { ativo: Boolean(body.ativo) }),
        atualizadoPorNome: session?.user?.nome || cleanPreviousUpdater || null,
      },
    });

    if (precoMudou) {
      await logPriceChange({
        session,
        produto: existing,
        precoAntigo: existing.preco,
        precoNovo: body.preco,
      });
    }

    if (isSupport && body.ativo !== undefined) {
      await logSupportAction({
        session,
        eventoId: existing.eventoId,
        acao: body.ativo ? 'ATIVACAO_PRODUTO' : 'DESATIVACAO_PRODUTO',
        detalhes: `${body.ativo ? 'Reativou' : 'Desativou'} o produto "${existing.nome}" (${existing.grupo})`,
        produtoId: existing.id,
        valor: existing.preco,
      });
    }

    return NextResponse.json(produto);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;

    const existing = await prisma.produto.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    await prisma.produto.update({
      where: { id },
      data: {
        ativo: false,
        atualizadoPorNome: `[EXCLUIDO] ${session?.user?.nome || 'Sistema'}`,
      },
    });

    await logSupportAction({
      session,
      eventoId: existing.eventoId,
      acao: 'EXCLUSAO_PRODUTO',
      detalhes: `Excluiu o produto "${existing.nome}" (${existing.grupo}) - R$ ${Number(existing.preco).toFixed(2)}`,
      produtoId: existing.id,
      valor: existing.preco,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
