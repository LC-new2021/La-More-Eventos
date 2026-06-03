import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const cpfRaw = searchParams.get('cpf') || '';
    const cpf = cpfRaw.replace(/\D/g, '');

    if (!cpf) {
      return NextResponse.json({ error: 'CPF não informado' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findFirst({
      where: { cpf },
      select: {
        nome: true,
        celular: true,
        email: true,
        creditCardToken: true,
        creditCardBrand: true,
        creditCardLastDigits: true,
      },
    });

    if (!cliente) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({ found: true, cliente });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
