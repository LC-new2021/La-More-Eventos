import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req) {
  try {
    const { clienteId, subscription } = await req.json();
    if (!clienteId || !subscription) {
      return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 });
    }

    await prisma.cliente.update({
      where: { id: clienteId },
      data: { pushSubscriptionJson: JSON.stringify(subscription) }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
