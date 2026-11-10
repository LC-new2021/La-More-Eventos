import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req) {
  try {
    const body = await req.json();
    const email = body?.email;
    if (!email) {
      return NextResponse.json({ destino: '/acessos' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const usuario = await prisma.usuario.findUnique({
      where: { email: cleanEmail },
      select: { role: true, ativo: true },
    });

    if (!usuario || !usuario.ativo) {
      return NextResponse.json({ destino: '/acessos' });
    }

    let role = usuario.role;
    if (role === 'CLIENTE' || role === 'SUPORTE') role = 'SUPORTE_OPERACIONAL';

    let destino = '/acessos';
    if (role === 'MASTER') {
      destino = '/master';
    } else if (['CAIXA', 'CAIXA_VOLANTE', 'TESOURARIA'].includes(role)) {
      destino = '/pos';
    } else if (role === 'OPERADOR_BAR' || role === 'BAR') {
      destino = '/bar';
    } else if (role === 'ORGANIZADOR' || role === 'SUPORTE_OPERACIONAL') {
      destino = '/org';
    }

    return NextResponse.json({ role, destino });
  } catch (e) {
    return NextResponse.json({ destino: '/acessos' });
  }
}
