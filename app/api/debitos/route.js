import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const { codigo, produtoId, quantidade } = await req.json();
    const qty = parseInt(quantidade) || 1;

    const cartao = await prisma.cartao.findUnique({ where: { codigo: codigo.toUpperCase() } });
    if (!cartao) return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    if (cartao.status !== 'ATIVO') return NextResponse.json({ error: 'Cartão bloqueado ou encerrado' }, { status: 400 });

    const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
    if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });

    const valorTotal = produto.preco * qty;
    if (cartao.saldo < valorTotal) {
      return NextResponse.json({ error: 'Saldo insuficiente', saldo: cartao.saldo }, { status: 402 });
    }

    // Débito atômico
    const [cartaoAtualizado] = await prisma.$transaction([
      prisma.cartao.update({
        where: { id: cartao.id },
        data: { saldo: { decrement: valorTotal } },
      }),
      prisma.movimentacao.create({
        data: {
          tipo: 'DEBITO',
          valor: valorTotal,
          descricao: qty > 1 ? `${qty}x ${produto.nome}` : produto.nome,
          cartaoId: cartao.id,
          produtoId: produto.id,
          operadorId: session?.user?.id,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      saldoAnterior: cartao.saldo,
      saldoAtual: cartaoAtualizado.saldo,
      produto: produto.nome,
      cliente: cartao.clienteId,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
