import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const cpfRaw = searchParams.get('cpf') || '';
    const celularRaw = searchParams.get('celular') || '';
    const eventoId = searchParams.get('eventoId') || '';

    const cleanCpf = cpfRaw.replace(/\D/g, '');
    const cleanCelular = celularRaw.replace(/\D/g, '');

    if (!cleanCpf && !cleanCelular) {
      return NextResponse.json({ error: 'Informe ao menos CPF ou Celular' }, { status: 400 });
    }

    let cliente = null;
    if (cleanCpf && cleanCpf.length === 11) {
      cliente = await prisma.cliente.findFirst({
        where: { cpf: cleanCpf },
      });
    }

    if (!cliente && cleanCelular && cleanCelular.length >= 10) {
      cliente = await prisma.cliente.findFirst({
        where: { celular: cleanCelular },
      });
    }

    if (!cliente) {
      return NextResponse.json({ found: false });
    }

    let cartaoExistente = null;
    if (eventoId) {
      cartaoExistente = await prisma.cartao.findFirst({
        where: {
          clienteId: cliente.id,
          eventoId: eventoId,
        },
      });
    }

    return NextResponse.json({
      found: true,
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        celular: cliente.celular,
        cpf: cliente.cpf,
        email: cliente.email,
        creditCardToken: cliente.creditCardToken,
        creditCardBrand: cliente.creditCardBrand,
        creditCardLastDigits: cliente.creditCardLastDigits,
      },
      cartaoExistente: cartaoExistente ? {
        id: cartaoExistente.id,
        codigo: cartaoExistente.codigo,
        saldo: cartaoExistente.saldo,
        status: cartaoExistente.status,
      } : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
