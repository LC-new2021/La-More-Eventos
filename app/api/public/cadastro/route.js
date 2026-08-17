import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { enviarSmsCartao } from '@/lib/sms';

// Helper function to generate an 8-character alphanumeric string
function generateCardCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomBytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

export async function POST(req) {
  try {
    const { eventoId, nome, cpf, celular } = await req.json();

    if (!eventoId || !nome || !celular) {
      return NextResponse.json({ error: 'Nome e Celular são obrigatórios' }, { status: 400 });
    }

    const evento = await prisma.evento.findUnique({
      where: { id: eventoId }
    });

    if (!evento) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    // Clean inputs
    const cleanCpf = cpf ? cpf.replace(/\D/g, '') : null;
    const cleanCelular = celular.replace(/\D/g, '');

    // Check if client already exists (by CPF if provided, else by Celular)
    let cliente = null;

    if (cleanCpf && cleanCpf.length === 11) {
      cliente = await prisma.cliente.findFirst({
        where: { cpf: cleanCpf }
      });
    }

    if (!cliente) {
      cliente = await prisma.cliente.findFirst({
        where: { celular: cleanCelular }
      });
    }

    // If client doesn't exist, create it
    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: {
          nome: nome.trim(),
          cpf: cleanCpf,
          celular: cleanCelular
        }
      });
    } else {
      // Opt: Update missing info if needed, but not strictly necessary
      if ((cleanCpf && !cliente.cpf) || (!cliente.nome)) {
        await prisma.cliente.update({
          where: { id: cliente.id },
          data: {
            cpf: cliente.cpf || cleanCpf,
            nome: cliente.nome || nome.trim()
          }
        });
      }
    }

    // Check if this client already has an active card for this event
    const existingCard = await prisma.cartao.findFirst({
      where: {
        clienteId: cliente.id,
        eventoId: evento.id
      }
    });

    if (existingCard) {
      // Dispara SMS de lembrete do cartão existente
      if (cleanCelular) {
        enviarSmsCartao({
          celular: cleanCelular,
          nomeCliente: cliente.nome,
          codigoCartao: existingCard.codigo,
          hostUrl: req.headers.get('origin')
        }).catch(err => console.error('[Auto-Cadastro] Erro ao reenviar SMS:', err));
      }
      return NextResponse.json({ success: true, codigo: existingCard.codigo });
    }

    // Generate a unique card code
    let codigo;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      codigo = generateCardCode();
      const existingCode = await prisma.cartao.findUnique({
        where: { codigo }
      });
      if (!existingCode) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json({ error: 'Falha ao gerar código único. Tente novamente.' }, { status: 500 });
    }

    // Create the new card
    const novoCartao = await prisma.cartao.create({
      data: {
        codigo,
        saldo: 0,
        status: 'ATIVO',
        clienteId: cliente.id,
        eventoId: evento.id
      }
    });

    // Disparo automático de SMS para o novo cartão criado
    if (cleanCelular) {
      enviarSmsCartao({
        celular: cleanCelular,
        nomeCliente: cliente.nome,
        codigoCartao: novoCartao.codigo,
        hostUrl: req.headers.get('origin')
      }).catch(err => console.error('[Auto-Cadastro] Erro ao disparar SMS:', err));
    }

    return NextResponse.json({ success: true, codigo: novoCartao.codigo });

  } catch (error) {
    console.error('Erro no auto-cadastro:', error);
    return NextResponse.json({ error: 'Falha interna ao processar o cadastro' }, { status: 500 });
  }
}
