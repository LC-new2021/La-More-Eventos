import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processarRecargaIdempotente } from '@/lib/recarga-service';

// Recebe notificações da Stone/Pagar.me
export async function POST(req) {
  try {
    const payload = await req.json().catch(() => ({}));

    if (payload.type === 'order.paid') {
      const order = payload.data;
      const orderId = order?.id;

      if (orderId) {
        const movimentacao = await prisma.movimentacao.findFirst({
          where: { gatewayId: String(orderId) },
          include: { cartao: true }
        });

        if (movimentacao && movimentacao.tipo === 'RECARGA_PENDENTE') {
          await prisma.$transaction([
            prisma.movimentacao.update({
              where: { id: movimentacao.id },
              data: { tipo: 'RECARGA', gatewayStatus: 'paid' }
            }),
            prisma.cartao.update({
              where: { id: movimentacao.cartaoId },
              data: { saldo: { increment: movimentacao.valor } }
            })
          ]);
          console.log(`[STONE WEBHOOK] Recarga de R$${movimentacao.valor} aprovada para o cartão ${movimentacao.cartao?.codigo}`);
        } else if (!movimentacao) {
          // Extrair código do item code
          const itemCode = order.items?.[0]?.code || '';
          let cartaoCodigo = '';
          if (itemCode.startsWith('REC_')) {
            cartaoCodigo = itemCode.replace('REC_', '');
          }
          const valor = parseFloat(order.amount ? (order.amount / 100) : 0);

          if (cartaoCodigo && valor > 0) {
            await processarRecargaIdempotente({
              cartaoCodigo,
              valor,
              gatewayId: String(orderId),
              gatewayStatus: 'paid',
              descricao: 'Recarga Online (Stone Webhook)',
              operadorNome: 'Stone Webhook'
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro no webhook da Stone:', error);
    return NextResponse.json({ error: 'Falha no processamento' }, { status: 500 });
  }
}
