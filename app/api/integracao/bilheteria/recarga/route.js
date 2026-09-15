import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      secret,
      bilheteriaEventoId,
      eventoNome,
      eventoIdLaMoreEventos,
      codigoPedido,
      codigoCartao,
      valorRecarga,
      titular,
    } = body;

    const EXPECTED_SECRET = process.env.LAMORE_INTEGRATION_SECRET || 'lamore_sec_360_integracao_bilheteria_eventos_2026';
    if (secret && secret !== EXPECTED_SECRET) {
      return NextResponse.json({ error: 'Chave secreta de integração inválida.' }, { status: 403 });
    }

    const valorFloat = parseFloat(valorRecarga || 0);
    const cartaoCode = (codigoCartao || `CART-${(codigoPedido || 'LM').replace(/[^A-Za-z0-9]/g, '').slice(-5)}`).toUpperCase();

    // 1. Localiza ou cria o Evento em La-More-Eventos
    let evento = null;
    if (eventoIdLaMoreEventos) {
      evento = await prisma.evento.findUnique({ where: { id: eventoIdLaMoreEventos } });
    }
    if (!evento && bilheteriaEventoId) {
      evento = await prisma.evento.findFirst({ where: { bilheteriaEventoId } });
    }
    if (!evento && eventoNome) {
      evento = await prisma.evento.findFirst({
        where: {
          nome: {
            contains: eventoNome.trim(),
          },
        },
      });
    }

    if (!evento) {
      evento = await prisma.evento.create({
        data: {
          nome: eventoNome || 'Evento Oficial La More',
          data: new Date(),
          local: 'La More Eventos',
          status: 'ATIVO',
          bilheteriaEventoId: bilheteriaEventoId || null,
          taxaMasterPercent: 5.0,
        },
      });
    } else if (bilheteriaEventoId && !evento.bilheteriaEventoId) {
      await prisma.evento.update({
        where: { id: evento.id },
        data: { bilheteriaEventoId },
      });
    }

    // 2. Localiza ou cria o Cliente
    const cpfLimpo = titular?.cpf ? titular.cpf.replace(/\D/g, '') : null;
    const celularLimpo = titular?.celular ? titular.celular.replace(/\D/g, '') : null;
    const emailLimpo = titular?.email ? titular.email.trim().toLowerCase() : null;
    const nomeCliente = (titular?.nome || 'Cliente Bilheteria').trim().toUpperCase();

    let cliente = null;
    if (cpfLimpo) {
      cliente = await prisma.cliente.findFirst({ where: { cpf: cpfLimpo } });
    }
    if (!cliente && celularLimpo) {
      cliente = await prisma.cliente.findFirst({ where: { celular: celularLimpo } });
    }
    if (!cliente && emailLimpo) {
      cliente = await prisma.cliente.findFirst({ where: { email: emailLimpo } });
    }

    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: {
          nome: nomeCliente,
          cpf: cpfLimpo,
          celular: celularLimpo,
          email: emailLimpo,
          criadoPorNome: 'Bilheteria Online',
        },
      });
    } else {
      // Atualiza nome e dados de contato reais sempre que vier da Bilheteria
      const updateData = {};
      if (nomeCliente && nomeCliente !== 'CLIENTE BILHETERIA' && cliente.nome !== nomeCliente) {
        updateData.nome = nomeCliente;
      }
      if (cpfLimpo && cliente.cpf !== cpfLimpo) updateData.cpf = cpfLimpo;
      if (celularLimpo && cliente.celular !== celularLimpo) updateData.celular = celularLimpo;
      if (emailLimpo && cliente.email !== emailLimpo) updateData.email = emailLimpo;
      if (Object.keys(updateData).length > 0) {
        cliente = await prisma.cliente.update({
          where: { id: cliente.id },
          data: updateData,
        });
      }
    }

    // 3. Localiza ou cria o Cartão especificamente para este Cliente e este Evento
    let cartao = await prisma.cartao.findFirst({
      where: { clienteId: cliente.id, eventoId: evento.id },
      include: { cliente: true, evento: true },
    });

    if (!cartao) {
      const codigoEmUso = await prisma.cartao.findUnique({ where: { codigo: cartaoCode } });
      const codigoFinal = codigoEmUso 
        ? `CART-${Date.now().toString(36).slice(-4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
        : cartaoCode;

      cartao = await prisma.cartao.create({
        data: {
          codigo: codigoFinal,
          saldo: 0,
          status: 'ATIVO',
          clienteId: cliente.id,
          eventoId: evento.id,
        },
        include: { cliente: true, evento: true },
      });
    }

    // 4. Se houver recarga e ainda não foi registrada
    if (valorFloat > 0) {
      const descBusca = `Recarga Bilheteria - Pedido ${codigoPedido || cartaoCode}`;
      const movExistente = await prisma.movimentacao.findFirst({
        where: {
          cartaoId: cartao.id,
          tipo: 'RECARGA',
          descricao: { contains: codigoPedido || cartaoCode },
        },
      });

      if (!movExistente) {
        await prisma.$transaction([
          prisma.cartao.update({
            where: { id: cartao.id },
            data: { saldo: { increment: valorFloat } },
          }),
          prisma.movimentacao.create({
            data: {
              tipo: 'RECARGA',
              valor: valorFloat,
              descricao: descBusca,
              cartaoId: cartao.id,
              operadorNome: 'Bilheteria Online',
              valorTaxaMaster: 0,
            },
          }),
        ]);

        cartao.saldo += valorFloat;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cartão ${cartao.codigo} sincronizado com sucesso no LaMore Eventos`,
      cartao: {
        id: cartao.id,
        codigo: cartao.codigo,
        saldo: cartao.saldo,
        status: cartao.status,
        clienteNome: cliente.nome,
        eventoNome: evento.nome,
      },
    });
  } catch (error) {
    console.error('[ERRO INTEGRACAO BILHETERIA/RECARGA]:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar integração' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const codigoCartao = searchParams.get('codigoCartao');
    const expectedSecret = process.env.LAMORE_INTEGRATION_SECRET || 'lamore_sec_360_integracao_bilheteria_eventos_2026';
    if (secret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Token de integração inválido' }, { status: 401 });
    }
    if (!codigoCartao) {
      return NextResponse.json({ error: 'Código do cartão é obrigatório' }, { status: 400 });
    }
    const codigoFormatado = codigoCartao.toUpperCase().trim();
    const cartao = await prisma.cartao.findFirst({
      where: { codigo: codigoFormatado },
    });
    if (cartao) {
      await prisma.movimentacao.deleteMany({ where: { cartaoId: cartao.id } });
      await prisma.cartao.delete({ where: { id: cartao.id } });
      return NextResponse.json({ success: true, mensagem: `Cartão ${codigoFormatado} e movimentações excluídos com sucesso.` });
    }
    return NextResponse.json({ success: true, mensagem: `Cartão ${codigoFormatado} não localizado ou já excluído.` });
  } catch (error) {
    console.error('Erro ao excluir cartão no LaMore Eventos:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao excluir' }, { status: 500 });
  }
}
