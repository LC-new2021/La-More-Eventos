import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req, { params }) {
  const { codigo } = await params;
  try {
    const { chavePix } = await req.json();

    if (!chavePix) {
      return NextResponse.json({ error: 'Chave PIX é obrigatória' }, { status: 400 });
    }

    // Transação atômica garantindo segurança contra Race Conditions (Gastos Duplos)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Busca o cartão bloqueando a linha para leitura (se fosse Postgres suportaria row-level lock, no SQLite trava o banco)
      const cartao = await tx.cartao.findUnique({
        where: { codigo: codigo.toUpperCase() },
        include: { evento: true }
      });

      if (!cartao) {
        throw new Error('Cartão não encontrado');
      }

      if (cartao.status !== 'ATIVO') {
        throw new Error('Cartão bloqueado ou inativo');
      }

      if (!cartao.evento.permiteDevolucao) {
        throw new Error('O organizador não ativou a devolução de saldo para este evento.');
      }

      if (cartao.saldo <= 0) {
        throw new Error('Saldo insuficiente para solicitar devolução.');
      }

      const valorDevolucao = cartao.saldo;

      // 2. Zera o saldo
      const updatedCartao = await tx.cartao.update({
        where: { id: cartao.id },
        data: { saldo: 0 }
      });

      // 3. Cria o recibo do débito no extrato do cartão
      await tx.movimentacao.create({
        data: {
          tipo: 'ESTORNO',
          valor: valorDevolucao,
          descricao: `Pedido de Devolução (PIX: ${chavePix})`,
          cartaoId: cartao.id,
        }
      });

      // 4. Cria a fila para o organizador aprovar
      const solicitacao = await tx.solicitacaoDevolucao.create({
        data: {
          valor: valorDevolucao,
          chavePix: chavePix,
          cartaoId: cartao.id,
          eventoId: cartao.eventoId,
          status: 'PENDENTE'
        }
      });

      return { cartao: updatedCartao, solicitacao };
    });

    return NextResponse.json({ success: true, valor: result.solicitacao.valor });

  } catch (error) {
    console.error("Erro na devolução:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
