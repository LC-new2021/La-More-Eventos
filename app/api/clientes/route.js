import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET — busca por nome ou CPF
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
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { nome, cpf, celular, email, eventoId, valorRecarga, pagamentos, cartaoExistente } = body;

    const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
    const taxaPct = evento?.taxaMasterPercent || 0;
    const valorFloat = parseFloat(valorRecarga);
    const valorTaxaMaster = (valorFloat * taxaPct) / 100;
    const descricaoPag = pagamentos?.map(p => p.metodo).join(', ') || 'Recarga';

    // ── Recarga em cartão existente ──
    if (cartaoExistente) {
      const cartao = await prisma.cartao.findUnique({ where: { codigo: cartaoExistente.toUpperCase() } });
      if (!cartao) return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });

      const [cartaoAtualizado] = await prisma.$transaction([
        prisma.cartao.update({
          where: { id: cartao.id },
          data: { saldo: { increment: valorFloat } },
        }),
        prisma.movimentacao.create({
          data: {
            tipo: 'RECARGA',
            valor: valorFloat,
            descricao: `Recarga — ${descricaoPag}`,
            cartaoId: cartao.id,
            operadorId: session?.user?.id,
            operadorNome: session?.user?.nome,
            valorTaxaMaster,
          },
        }),
      ]);
      return NextResponse.json({ cartao: cartaoAtualizado, codigo: cartaoExistente });
    }

    // ── Novo cliente ──
    const codigo = 'LM' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

    let cliente = cpf?.replace(/\D/g,'') ? await prisma.cliente.findFirst({ where: { cpf: cpf.replace(/\D/g,'') } }) : null;
    if (!cliente) {
      cliente = await prisma.cliente.create({ 
        data: { 
          nome, 
          cpf: cpf?.replace(/\D/g,''), 
          celular: celular?.replace(/\D/g,''), 
          email,
          criadoPorId: session?.user?.id,
          criadoPorNome: session?.user?.nome
        } 
      });
    }

    const cartaoExistenteNoDB = await prisma.cartao.findFirst({ where: { clienteId: cliente.id, eventoId } });
    if (cartaoExistenteNoDB) {
      return NextResponse.json({ error: 'Cliente já possui cartão neste evento. Use "Buscar Cliente" para recarregar.' }, { status: 409 });
    }

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
            valorTaxaMaster,
          },
        },
      },
      include: { cliente: true },
    });

    return NextResponse.json({ cartao, codigo }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
