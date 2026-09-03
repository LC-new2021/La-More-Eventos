import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['MASTER', 'ORGANIZADOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { eventoId, bilheteriaEventoId: customBilheteriaId } = body;

    if (!eventoId) {
      return NextResponse.json({ error: 'ID do evento é obrigatório' }, { status: 400 });
    }

    const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
    if (!evento) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    const bilheteriaId = customBilheteriaId || evento.bilheteriaEventoId;
    if (!bilheteriaId) {
      return NextResponse.json({
        error: 'Este evento ainda não possui o ID do evento da bilheteria vinculado. Informe o ID do evento para sincronizar.',
      }, { status: 400 });
    }

    // Salva o bilheteriaEventoId no evento caso tenha sido informado agora
    if (customBilheteriaId && evento.bilheteriaEventoId !== customBilheteriaId) {
      await prisma.evento.update({
        where: { id: evento.id },
        data: { bilheteriaEventoId: customBilheteriaId },
      });
    }

    const bilheteriaUrl = process.env.BILHETERIA_URL || 'https://lamorebilheteria-production.up.railway.app';
    const secret = process.env.LAMORE_INTEGRATION_SECRET || 'lamore_sec_360_integracao_bilheteria_eventos_2026';

    const res = await fetch(`${bilheteriaUrl}/api/integracao/eventos/${bilheteriaId}/recargas?secret=${secret}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({
        error: data.error || 'Não foi possível consultar as vendas na bilheteria.',
      }, { status: res.status });
    }

    const recargas = data.recargas || [];
    let importados = 0;
    let jaExistentes = 0;
    let valorTotalImportado = 0;

    for (const item of recargas) {
      const { codigoPedido, codigoCartao, valorRecarga, titular } = item;
      if (!titular || !codigoCartao || !valorRecarga || valorRecarga <= 0) continue;

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
      }

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

        importados++;
        valorTotalImportado += valorFloat;
      } else {
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

          importados++;
          valorTotalImportado += valorFloat;
        } else {
          jaExistentes++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      mensagem: `Sincronização concluída com sucesso!`,
      totalNaBilheteria: recargas.length,
      novosImportados: importados,
      jaSincronizados: jaExistentes,
      valorTotalImportado,
    });
  } catch (error) {
    console.error('Erro na sincronização manual da bilheteria:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
