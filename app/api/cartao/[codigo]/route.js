import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const { codigo } = await params;
    const rawCodigo = (codigo || '').trim();
    if (!rawCodigo) {
      return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 });
    }

    const codigoUpper = rawCodigo.toUpperCase();
    const codigoLimpo = codigoUpper.replace(/^CART-+/i, '').replace(/[^A-Za-z0-9]/g, '');

    // 1. Busca direta local por código exato ou variações de prefixo
    let cartao = await prisma.cartao.findFirst({
      where: {
        OR: [
          { codigo: codigoUpper },
          { codigo: rawCodigo },
          { codigo: `CART-${codigoLimpo}` },
          { codigo: `CART--${codigoLimpo}` },
          { codigo: codigoLimpo },
        ],
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

    // 2. Auto-Recuperação Inteligente: se o cartão não foi encontrado localmente,
    // consulta a API da La More Bilheteria para verificar se é um ingresso/voucher válido
    if (!cartao) {
      try {
        const bilheteriaUrl = process.env.LAMORE_BILHETERIA_URL || 'https://lamorebilheteria-production.up.railway.app';
        const resBilheteria = await fetch(`${bilheteriaUrl}/api/integracao/consultar-cartao?codigo=${encodeURIComponent(codigoUpper)}`, {
          headers: { 'Content-Type': 'application/json' },
          next: { revalidate: 0 },
        });

        if (resBilheteria.ok) {
          const dataBilheteria = await resBilheteria.json();
          if (dataBilheteria.encontrado) {
            // Localiza ou cria o Evento
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

            // Localiza ou cria o Cliente
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

            const valorFloat = parseFloat(dataBilheteria.valorRecarga || 0);
            const codigoFinalDesejado = (dataBilheteria.codigoCartao || codigoUpper).toUpperCase();

            // CRÍTICO: Verifica se o cliente já possui um cartão para este evento (respeitando @@unique([clienteId, eventoId]))
            let cartaoExistente = await prisma.cartao.findFirst({
              where: { clienteId: cliente.id, eventoId: evento.id },
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

            if (cartaoExistente) {
              // Se o cartão já existe, atualiza o código para o desejado caso seja diferente e não colida
              if (cartaoExistente.codigo !== codigoFinalDesejado && cartaoExistente.codigo !== codigoUpper) {
                const colidindo = await prisma.cartao.findUnique({ where: { codigo: codigoFinalDesejado } });
                if (!colidindo) {
                  cartaoExistente = await prisma.cartao.update({
                    where: { id: cartaoExistente.id },
                    data: { codigo: codigoFinalDesejado },
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

              // Se houver saldo novo na bilheteria maior que o registrado
              if (valorFloat > cartaoExistente.saldo) {
                const dif = valorFloat - cartaoExistente.saldo;
                await prisma.cartao.update({
                  where: { id: cartaoExistente.id },
                  data: { saldo: valorFloat },
                });
                await prisma.movimentacao.create({
                  data: {
                    tipo: 'RECARGA',
                    valor: dif,
                    descricao: `Recarga Bilheteria - Pedido ${dataBilheteria.codigoPedido || codigoUpper}`,
                    cartaoId: cartaoExistente.id,
                    operadorNome: 'Bilheteria Online',
                    valorTaxaMaster: 0,
                  },
                });
                cartaoExistente.saldo = valorFloat;
              }

              cartao = cartaoExistente;
            } else {
              // Cria novo cartão
              cartao = await prisma.cartao.create({
                data: {
                  codigo: codigoFinalDesejado,
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
        }
      } catch (errRecuperacao) {
        console.warn('[AUTO-RECUPERAÇÃO CARTÃO FALHOU]:', errRecuperacao.message);
      }
    }

    // 3. Fallback adicional por sufixo de código se ainda não encontrou
    if (!cartao && codigoLimpo.length >= 4) {
      cartao = await prisma.cartao.findFirst({
        where: {
          codigo: { contains: codigoLimpo },
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

    if (!cartao) return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    return NextResponse.json(cartao);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
