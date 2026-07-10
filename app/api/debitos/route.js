import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { enviarNotificacao } from '@/lib/push';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const { codigo, produtoId, quantidade, precoCustom } = await req.json();
    const qty = parseInt(quantidade) || 1;

    const cartao = await prisma.cartao.findUnique({
      where: { codigo: codigo.toUpperCase() },
      include: { cliente: true }
    });
    if (!cartao) return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    if (cartao.status !== 'ATIVO') return NextResponse.json({ error: 'Cartão bloqueado ou encerrado' }, { status: 400 });

    const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
    if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });

    if (cartao.eventoId !== produto.eventoId) {
      return NextResponse.json({ error: 'Este cartão pertence a outro evento e não pode ser cobrado neste bar' }, { status: 400 });
    }

    const precoUnitario = (produto.precoVariavel && precoCustom && parseFloat(precoCustom) > 0)
      ? parseFloat(precoCustom)
      : produto.preco;
    const valorTotal = precoUnitario * qty;
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
          operadorNome: session?.user?.nome,
        },
      }),
    ]);

    // Enviar notificação push se configurada
    if (cartao.cliente?.pushSubscriptionJson) {
      const formattedTotal = valorTotal.toFixed(2).replace('.', ',');
      const formattedSaldo = cartaoAtualizado.saldo.toFixed(2).replace('.', ',');
      enviarNotificacao(
        cartao.cliente.pushSubscriptionJson,
        'Consumo Confirmado! 🍻',
        `${qty > 1 ? `${qty}x ` : ''}${produto.nome} - R$ ${formattedTotal} debitados. Novo saldo: R$ ${formattedSaldo}.`,
        `/cartao/${codigo.toUpperCase()}`
      ).catch(console.error);
    }

    // Notificação removida para operadores (era disparada em loop para todo mundo)

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
