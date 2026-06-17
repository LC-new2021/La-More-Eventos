import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado. Apenas Master pode realizar estorno direto.' }, { status: 401 });
    }

    const { codigo } = await req.json();

    if (!codigo) {
      return NextResponse.json({ error: 'Código do cartão é obrigatório.' }, { status: 400 });
    }

    // Transação atômica
    const result = await prisma.$transaction(async (tx) => {
      const cartao = await tx.cartao.findUnique({
        where: { codigo: codigo.toUpperCase() }
      });

      if (!cartao) throw new Error('Cartão não encontrado.');
      if (cartao.saldo <= 0) throw new Error('O cartão não possui saldo para ser devolvido.');

      const valorEstorno = cartao.saldo;

      // Zera o saldo
      const updatedCartao = await tx.cartao.update({
        where: { id: cartao.id },
        data: { saldo: 0 }
      });

      // Cria a movimentação de estorno manual pelo Master
      const mov = await tx.movimentacao.create({
        data: {
          tipo: 'ESTORNO',
          valor: valorEstorno,
          descricao: `Devolução Manual de Saldo (Admin Master)`,
          cartaoId: cartao.id,
          operadorId: session.user.id
        }
      });

      return { updatedCartao, mov };
    });

    return NextResponse.json({ success: true, saldoAnterior: result.mov.valor });

  } catch (error) {
    console.error('Erro no estorno direto:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
