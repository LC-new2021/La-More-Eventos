import { NextResponse } from 'next/server';
import { generateGoogleWalletPassUrl } from '../../../../../lib/google-wallet';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req, { params }) {
  const { codigo } = await params;

  if (!codigo) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
  }

  try {
    const cartao = await prisma.cartao.findUnique({
      where: { codigo: codigo.toUpperCase() },
      include: { cliente: true }
    });

    if (!cartao) {
      return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    }

    const saveUrl = await generateGoogleWalletPassUrl(cartao, cartao.cliente);

    return NextResponse.json({ url: saveUrl }, { status: 200 });

  } catch (error) {
    console.error('Erro na API de Google Wallet:', error);
    return NextResponse.json({ 
      error: 'Falha ao gerar o link do Google Wallet.', 
      details: error.message 
    }, { status: 500 });
  }
}
