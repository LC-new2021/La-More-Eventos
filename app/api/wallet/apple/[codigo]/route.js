import { NextResponse } from 'next/server';
import { generateAppleWalletPass } from '../../../../../lib/apple-wallet';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req, { params }) {
  const { codigo } = await params;

  if (!codigo) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
  }

  try {
    // Buscar dados do cartão e cliente no banco
    const cartao = await prisma.cartao.findUnique({
      where: { codigo: codigo.toUpperCase() },
      include: { cliente: true }
    });

    if (!cartao) {
      return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    }

    // Gerar o buffer do pkpass
    const passBuffer = await generateAppleWalletPass(cartao, cartao.cliente);

    // Retornar o arquivo com o header correto para o iOS reconhecer como Wallet Pass
    return new NextResponse(passBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename=lamore-${cartao.codigo}.pkpass`
      }
    });

  } catch (error) {
    console.error('Erro na API de Apple Wallet:', error);
    return NextResponse.json({ 
      error: 'Falha ao gerar o cartão da Apple Wallet.', 
      details: error.message 
    }, { status: 500 });
  }
}
