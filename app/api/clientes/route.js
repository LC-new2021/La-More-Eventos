import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { enviarSmsCartao } from '@/lib/sms';

// GET — busca por nome, CPF, celular ou código
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const eventoId = searchParams.get('eventoId');
  try {
    if (!eventoId) {
      return NextResponse.json({ error: 'eventoId é obrigatório' }, { status: 400 });
    }

    const cartoes = await prisma.cartao.findMany({
      where: { eventoId },
      include: {
        cliente: true,
        movimentacoes: {
          where: { tipo: "RECARGA" },
          orderBy: { criadaEm: "asc" },
          take: 1,
          include: {
            operador: {
              select: { nome: true, role: true }
            }
          }
        }
      },
      orderBy: { criadoEm: 'desc' },
    });

    const totalCadastrados = await prisma.cartao.count({
      where: { eventoId }
    });

    let filtered = cartoes.map(c => {
      const recargaInicial = c.movimentacoes?.[0];
      const operador = recargaInicial?.operador;
      return {
        ...c,
        cadastradoPor: c.cliente?.criadoPorNome || (operador ? `${operador.nome} (${operador.role})` : "Sistema / Outro")
      };
    });

    if (q.trim()) {
      const queryLower = q.toLowerCase();
      filtered = filtered.filter(c => {
        const nomeMatch = c.cliente?.nome?.toLowerCase().includes(queryLower);
        const cpfMatch = c.cliente?.cpf?.includes(queryLower);
        const celularMatch = c.cliente?.celular?.includes(queryLower);
        const codigoMatch = c.codigo?.toLowerCase().includes(queryLower);
        return nomeMatch || cpfMatch || celularMatch || codigoMatch;
      });
    }

    const response = NextResponse.json(filtered);
    response.headers.set('X-Total-Count', totalCadastrados.toString());
    return response;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — cadastrar novo cliente E emitir cartão com recarga
//        OU recarregar cartão existente (cartaoExistente = codigo)
//        GARANTE NÃO GERAR CARTÃO REPETIDO
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { nome, cpf, celular, email, eventoId, valorRecarga, pagamentos, cartaoExistente } = body;

    const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
    if (!evento) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    const taxaPct = evento?.taxaMasterPercent || 0;
    const valorFloat = parseFloat(valorRecarga) || 0;
    const valorTaxaMaster = (valorFloat * taxaPct) / 100;
    const descricaoPag = pagamentos?.map(p => p.metodo).join(', ') || 'Recarga';

    const primeiroGatewayId = pagamentos?.find(p => p.gatewayId)?.gatewayId
      ? String(pagamentos.find(p => p.gatewayId).gatewayId).trim()
      : null;

    // ── 1. Recarga explícita em cartão existente informado no frontend ──
    if (cartaoExistente) {
      const cartao = await prisma.cartao.findUnique({ 
        where: { codigo: cartaoExistente.toUpperCase().trim() },
        include: { cliente: true }
      });
      if (!cartao) return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });

      // Blindagem anti-duplicidade de transações online
      if (primeiroGatewayId) {
        const movJaCreditada = await prisma.movimentacao.findFirst({
          where: { gatewayId: primeiroGatewayId },
        });
        if (movJaCreditada) {
          const cartaoAtual = await prisma.cartao.findUnique({ where: { id: cartao.id } });
          return NextResponse.json({ cartao: cartaoAtual, codigo: cartaoExistente, jaProcessado: true });
        }
      }

      const [cartaoAtualizado] = await prisma.$transaction([
        prisma.cartao.update({
          where: { id: cartao.id },
          data: { saldo: { increment: valorFloat } },
          include: { cliente: true },
        }),
        prisma.movimentacao.create({
          data: {
            tipo: 'RECARGA',
            valor: valorFloat,
            descricao: `Recarga — ${descricaoPag}`,
            cartaoId: cartao.id,
            operadorId: session?.user?.id,
            operadorNome: session?.user?.nome,
            gatewayId: primeiroGatewayId,
            gatewayStatus: primeiroGatewayId ? 'CONFIRMADO' : null,
            valorTaxaMaster,
          },
        }),
      ]);
      return NextResponse.json({ cartao: cartaoAtualizado, codigo: cartaoExistente });
    }

    // ── 2. Fluxo Anti-Duplicação inteligente ──
    const cleanCpf = cpf ? cpf.replace(/\D/g, '') : null;
    const cleanCelular = celular ? celular.replace(/\D/g, '') : null;
    const cleanNome = (nome || '').trim();

    // Busca cliente existente por CPF, Celular ou Nome no Evento
    let cliente = null;
    if (cleanCpf && cleanCpf.length === 11) {
      cliente = await prisma.cliente.findFirst({ where: { cpf: cleanCpf } });
    }
    if (!cliente && cleanCelular && cleanCelular.length >= 10) {
      cliente = await prisma.cliente.findFirst({ where: { celular: cleanCelular } });
    }
    if (!cliente && cleanNome) {
      // Procura se já tem cliente com mesmo nome exato neste evento
      const cartaoMesmoNome = await prisma.cartao.findFirst({
        where: {
          eventoId,
          cliente: {
            nome: { equals: cleanNome }
          }
        },
        include: { cliente: true }
      });
      if (cartaoMesmoNome?.cliente) {
        cliente = cartaoMesmoNome.cliente;
      }
    }

    // Se achou o cliente, atualiza dados que estavam em branco
    if (cliente) {
      const updates = {};
      if (cleanCpf && !cliente.cpf) updates.cpf = cleanCpf;
      if (cleanCelular && !cliente.celular) updates.celular = cleanCelular;
      if (email && !cliente.email) updates.email = email;
      if (cleanNome && cliente.nome !== cleanNome) updates.nome = cleanNome;

      if (Object.keys(updates).length > 0) {
        cliente = await prisma.cliente.update({
          where: { id: cliente.id },
          data: updates,
        });
      }
    } else {
      // Cria cliente somente se ele realmente não existe
      cliente = await prisma.cliente.create({ 
        data: { 
          nome: cleanNome, 
          cpf: cleanCpf, 
          celular: cleanCelular, 
          email,
          criadoPorId: session?.user?.id,
          criadoPorNome: session?.user?.nome
        } 
      });
    }

    // VERIFICAÇÃO CRÍTICA: O cliente já possui cartão neste evento?
    const cartaoExistenteNoDB = await prisma.cartao.findFirst({
      where: { clienteId: cliente.id, eventoId },
      include: { cliente: true }
    });

    if (cartaoExistenteNoDB) {
      // PROTEÇÃO ATIVA: NÃO GERA CARTÃO REPETIDO!
      // Se houver transação online já creditada
      if (primeiroGatewayId) {
        const movJaCreditada = await prisma.movimentacao.findFirst({
          where: { gatewayId: primeiroGatewayId },
        });
        if (movJaCreditada) {
          const cartaoAtual = await prisma.cartao.findUnique({ where: { id: cartaoExistenteNoDB.id } });
          return NextResponse.json({ cartao: cartaoAtual, codigo: cartaoExistenteNoDB.codigo, jaProcessado: true });
        }
      }

      // Se tiver valor de recarga, credita no cartão existente
      if (valorFloat > 0) {
        const [cartaoAtualizado] = await prisma.$transaction([
          prisma.cartao.update({
            where: { id: cartaoExistenteNoDB.id },
            data: { saldo: { increment: valorFloat } },
            include: { cliente: true },
          }),
          prisma.movimentacao.create({
            data: {
              tipo: 'RECARGA',
              valor: valorFloat,
              descricao: `Recarga — ${descricaoPag}`,
              cartaoId: cartaoExistenteNoDB.id,
              operadorId: session?.user?.id,
              operadorNome: session?.user?.nome,
              gatewayId: primeiroGatewayId,
              gatewayStatus: primeiroGatewayId ? 'CONFIRMADO' : null,
              valorTaxaMaster,
            },
          }),
        ]);

        return NextResponse.json({
          cartao: cartaoAtualizado,
          codigo: cartaoAtualizado.codigo,
          reloaded: true,
          aviso: `Cliente já possuía o cartão ${cartaoAtualizado.codigo}. O saldo foi adicionado diretamente a ele para não duplicar cartões.`
        }, { status: 200 });
      }

      return NextResponse.json({
        cartao: cartaoExistenteNoDB,
        codigo: cartaoExistenteNoDB.codigo,
        reloaded: false,
        aviso: `Cliente já possui o cartão ${cartaoExistenteNoDB.codigo} neste evento.`
      }, { status: 200 });
    }

    // ── 3. Cliente novo sem cartão: Gera código único e cria o cartão ──
    const codigo = 'LM' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

    const cartao = await prisma.cartao.create({
      data: {
        codigo,
        saldo: valorFloat,
        clienteId: cliente.id,
        eventoId,
        movimentacoes: {
          create: {
            tipo: 'RECARGA',
            valor: valorFloat,
            descricao: `Recarga inicial — ${descricaoPag}`,
            operadorId: session?.user?.id,
            operadorNome: session?.user?.nome,
            gatewayId: primeiroGatewayId,
            gatewayStatus: primeiroGatewayId ? 'CONFIRMADO' : null,
            valorTaxaMaster,
          },
        },
      },
      include: { cliente: true },
    });

    // Disparo automático de SMS com link direto do cartão
    if (cliente?.celular) {
      enviarSmsCartao({
        celular: cliente.celular,
        nomeCliente: cliente.nome,
        codigoCartao: codigo,
        hostUrl: req.headers.get('origin')
      }).catch(err => console.error('[API Clientes] Falha ao disparar SMS:', err));
    }

    return NextResponse.json({ cartao, codigo }, { status: 201 });
  } catch (e) {
    console.error('[API Clientes] Erro:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
