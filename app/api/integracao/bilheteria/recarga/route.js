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

    const expectedSecret = process.env.LAMORE_INTEGRATION_SECRET || 'lamore_sec_360_integracao_bilheteria_eventos_2026';
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Token de integração inválido' }, { status: 401 });
    }

    if (!titular || !codigoCartao || !valorRecarga || valorRecarga <= 0) {
      return NextResponse.json({ error: 'Dados incompletos para processar a recarga' }, { status: 400 });
    }

    // 1. Localiza o Evento correspondente no LaMore Eventos
    let evento = null;
    if (bilheteriaEventoId) {
      evento = await prisma.evento.findFirst({ where: { bilheteriaEventoId } });
    }
    if (!evento && eventoIdLaMoreEventos) {
      evento = await prisma.evento.findUnique({ where: { id: eventoIdLaMoreEventos } });
    }
    if (!evento && eventoNome) {
      evento = await prisma.evento.findFirst({
        where: {
          nome: { contains: eventoNome, mode: 'insensitive' }
        }
      });
    }
    // Se não encontrou por ID nem por nome, cria o evento automaticamente no LaMore Eventos com o nome exato!
    if (!evento && (eventoNome || bilheteriaEventoId)) {
      try {
        evento = await prisma.evento.create({
          data: {
            nome: eventoNome || 'Evento Bilheteria',
            bilheteriaEventoId: bilheteriaEventoId || null,
            status: 'ATIVO',
            modoOperacao: 'GERENCIAL',
          },
        });
        console.log(`[INTEGRAÇÃO LAMORE EVENTOS] Evento '${evento.nome}' criado com sucesso para a festa da Bilheteria.`);
      } catch (errCreateEv) {
        console.warn('[INTEGRAÇÃO LAMORE EVENTOS] Falha ao auto-criar evento:', errCreateEv.message);
      }
    }

    if (!evento) {
      return NextResponse.json({
        error: `O evento '${eventoNome || bilheteriaEventoId}' não foi localizado no LaMore Eventos. Por favor, crie o evento no painel do LaMore Eventos ou informe o ID do evento.`
      }, { status: 404 });
    }

    // Se o evento não tinha o bilheteriaEventoId salvo, vincula agora
    if (bilheteriaEventoId && !evento.bilheteriaEventoId) {
      await prisma.evento.update({
        where: { id: evento.id },
        data: { bilheteriaEventoId },
      });
    }

    // 2. Localiza ou cria o Cliente (pelo CPF ou celular)
    const cpfClean = titular.cpf ? titular.cpf.replace(/\D/g, '') : null;
    let cliente = null;

    if (cpfClean) {
      cliente = await prisma.cliente.findFirst({ where: { cpf: cpfClean } });
    }
    if (!cliente && titular.celular) {
      cliente = await prisma.cliente.findFirst({ where: { celular: titular.celular } });
    }

    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: {
          nome: titular.nome || 'Cliente Bilheteria',
          cpf: cpfClean,
          celular: titular.celular || null,
          email: titular.email || null,
        },
      });
    } else {
      await prisma.cliente.update({
        where: { id: cliente.id },
        data: {
          nome: titular.nome || cliente.nome,
          celular: titular.celular || cliente.celular,
          email: titular.email || cliente.email,
        },
      });
    }

    // 3. Localiza ou cria o Cartão de Consumo Digital
    const codigoFormatado = codigoCartao.toUpperCase().trim();
    let cartao = await prisma.cartao.findFirst({
      where: {
        OR: [
          { codigo: codigoFormatado },
          { clienteId: cliente.id, eventoId: evento.id },
        ],
      },
    });

    const valorFloat = parseFloat(valorRecarga);

    if (!cartao) {
      cartao = await prisma.cartao.create({
        data: {
          codigo: codigoFormatado,
          clienteId: cliente.id,
          eventoId: evento.id,
          saldo: valorFloat,
          status: 'ATIVO',
        },
      });

      await prisma.movimentacao.create({
        data: {
          tipo: 'RECARGA',
          valor: valorFloat,
          descricao: `Recarga Antecipada Bilheteria (Pedido ${codigoPedido})`,
          cartaoId: cartao.id,
          gatewayId: codigoPedido,
          gatewayStatus: 'CONFIRMADO',
          valorTaxaMaster: 0,
        },
      });
    } else {
      // Já existe cartão: verifica se essa recarga específica do pedido já foi registrada
      const movExistente = await prisma.movimentacao.findFirst({
        where: {
          cartaoId: cartao.id,
          gatewayId: codigoPedido,
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
              descricao: `Recarga Antecipada Bilheteria (Pedido ${codigoPedido})`,
              cartaoId: cartao.id,
              gatewayId: codigoPedido,
              gatewayStatus: 'CONFIRMADO',
              valorTaxaMaster: 0,
            },
          }),
        ]);

        cartao = await prisma.cartao.findUnique({ where: { id: cartao.id } });
      }
    }

    return NextResponse.json({
      success: true,
      mensagem: 'Recarga sincronizada com sucesso no LaMore Eventos',
      cartao: {
        id: cartao.id,
        codigo: cartao.codigo,
        saldo: cartao.saldo,
        status: cartao.status,
      },
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        cpf: cliente.cpf,
      },
      evento: {
        id: evento.id,
        nome: evento.nome,
      },
    });
  } catch (error) {
    console.error('Erro na rota de recarga da bilheteria:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const codigoCartao = searchParams.get('codigoCartao');
    const expectedSecret = process.env.LAMORE_INTEGRATION_SECRET || 'lamore_sec_360_integracao_bilheteria_eventos_2026';
    if (secret !== expectedSecret) {
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

