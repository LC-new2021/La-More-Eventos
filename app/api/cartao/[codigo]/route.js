import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const { codigo } = await params;
    const codigoUpper = codigo.toUpperCase();

    let cartao = await prisma.cartao.findUnique({
      where: { codigo: codigoUpper },
      include: {
        cliente: true,
        evento: { select: { id: true, nome: true, status: true, mercadoPagoPublicKey: true, modoOperacao: true, permiteDevolucao: true } },
        movimentacoes: {
          orderBy: { criadaEm: 'desc' },
          take: 10,
          include: { produto: { select: { nome: true } } },
        },
      },
    });

    // Auto-Recuperação Inteligente: se o cartão não foi encontrado localmente,
    // consulta a API da La More Bilheteria para verificar se é um ingresso/voucher válido
    if (!cartao) {
      try {
        const bilheteriaUrl = process.env.LAMORE_BILHETERIA_URL || 'https://lamorebilheteria-production.up.railway.app';
        const resBilheteria = await fetch(`${bilheteriaUrl}/api/integracao/consultar-cartao?codigo=${codigoUpper}`, {
          headers: { 'Content-Type': 'application/json' },
          next: { revalidate: 0 },
        });

        if (resBilheteria.ok) {
          const dataBilheteria = await resBilheteria.json();
          if (dataBilheteria.encontrado) {
            // Cria evento, cliente e cartão automaticamente
            let evento = null;
            if (dataBilheteria.bilheteriaEventoId) {
              evento = await prisma.evento.findFirst({ where: { bilheteriaEventoId: dataBilheteria.bilheteriaEventoId } });
            }
            if (!evento && dataBilheteria.eventoNome) {
              evento = await prisma.evento.findFirst({ where: { nome: { contains: dataBilheteria.eventoNome.trim() } } });
            }
            if (!evento) {
              evento = await prisma.evento.create({
                data: {
                  nome: dataBilheteria.eventoNome || 'Evento Oficial La More',
                  data: new Date(),
                  local: 'La More Eventos',
                  status: 'ATIVO',
                  bilheteriaEventoId: dataBilheteria.bilheteriaEventoId || null,
                  taxaMasterPercent: 5.0,
                },
              });
            }

            const cpfLimpo = dataBilheteria.titular?.cpf ? dataBilheteria.titular.cpf.replace(/\D/g, '') : null;
            const celularLimpo = dataBilheteria.titular?.celular ? dataBilheteria.titular.celular.replace(/\D/g, '') : null;
            const emailLimpo = dataBilheteria.titular?.email ? dataBilheteria.titular.email.trim().toLowerCase() : null;
            const nomeCliente = (dataBilheteria.titular?.nome || 'Cliente Bilheteria').trim().toUpperCase();

            let cliente = null;
            if (cpfLimpo) cliente = await prisma.cliente.findFirst({ where: { cpf: cpfLimpo } });
            if (!cliente && celularLimpo) cliente = await prisma.cliente.findFirst({ where: { celular: celularLimpo } });
            if (!cliente && emailLimpo) cliente = await prisma.cliente.findFirst({ where: { email: emailLimpo } });

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
            }

            const valorFloat = parseFloat(dataBilheteria.valorRecarga || 0);

            cartao = await prisma.cartao.create({
              data: {
                codigo: codigoUpper,
                saldo: valorFloat,
                status: 'ATIVO',
                clienteId: cliente.id,
                eventoId: evento.id,
                ...(valorFloat > 0
                  ? {
                      movimentacoes: {
                        create: {
                          tipo: 'RECARGA',
                          valor: valorFloat,
                          descricao: `Recarga Bilheteria - Pedido ${dataBilheteria.codigoPedido || codigoUpper}`,
                          operadorNome: 'Bilheteria Online',
                          valorTaxaMaster: 0,
                        },
                      },
                    }
                  : {}),
              },
              include: {
                cliente: true,
                evento: { select: { id: true, nome: true, status: true, mercadoPagoPublicKey: true, modoOperacao: true, permiteDevolucao: true } },
                movimentacoes: {
                  orderBy: { criadaEm: 'desc' },
                  take: 10,
                  include: { produto: { select: { nome: true } } },
                },
              },
            });
          }
        }
      } catch (errRecuperacao) {
        console.warn('[AUTO-RECUPERAÇÃO CARTÃO FALHOU]:', errRecuperacao.message);
      }
    }

    if (!cartao) return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    return NextResponse.json(cartao);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
