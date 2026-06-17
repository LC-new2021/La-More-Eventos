import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Recebe notificações da Stone/Pagar.me
export async function POST(req) {
  try {
    const payload = await req.json();

    // A Stone avisa quando o status do pedido muda. Vamos escutar quando for pago.
    if (payload.type === 'order.paid') {
      const order = payload.data; // Dados do pedido

      // Procura a movimentação pendente no nosso banco atrelada a esse pedido
      const movimentacao = await prisma.movimentacao.findFirst({
        where: { 
          gatewayId: order.id,
          tipo: 'RECARGA_PENDENTE' 
        },
        include: { cartao: true }
      });

      if (movimentacao) {
        // Transação atômica para efetivar a recarga
        await prisma.$transaction([
          prisma.movimentacao.update({
            where: { id: movimentacao.id },
            data: { 
              tipo: 'RECARGA',
              gatewayStatus: 'paid'
            }
          }),
          prisma.cartao.update({
            where: { id: movimentacao.cartaoId },
            data: { saldo: { increment: movimentacao.valor } }
          })
        ]);
        console.log(`[STONE WEBHOOK] Recarga de R$${movimentacao.valor} aprovada para o cartão ${movimentacao.cartao.codigo}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook da Stone:', error);
    return NextResponse.json({ error: 'Falha no processamento' }, { status: 500 });
  }
}
