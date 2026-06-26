import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req) {
  try {
    const { valor, eventoId } = await req.json();
    if (!valor || !eventoId) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });

    const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
    if (!evento) throw new Error('Evento não encontrado');

    if (evento.gatewayActive !== 'MERCADO_PAGO' || !evento.mercadoPagoAccessToken) {
      throw new Error('Mercado Pago não está configurado para este evento');
    }

    const mpPayload = {
      items: [
        {
          title: "Recarga de Saldo - Caixa",
          description: "Pagamento de Cartão Avulso",
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(valor)
        }
      ],
      auto_return: "approved"
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${evento.mercadoPagoAccessToken.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mpPayload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao gerar checkout');

    return NextResponse.json({ url: data.init_point });
  } catch (error) {
    console.error('Erro checkout avulso:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
