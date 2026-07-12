import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    let eventoId = searchParams.get('eventoId');

    if (session?.user?.role === 'ORGANIZADOR') {
      eventoId = session.user.eventoId;
    } else if (session?.user?.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    if (!eventoId) {
      return NextResponse.json({ error: 'ID do evento não fornecido' }, { status: 400 });
    }

    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    let dateFilter = {};
    if (dataInicio || dataFim) {
      dateFilter.criadaEm = {};
      if (dataInicio) {
        const start = new Date(dataInicio);
        start.setUTCHours(0, 0, 0, 0);
        dateFilter.criadaEm.gte = start;
      }
      if (dataFim) {
        const end = new Date(dataFim);
        end.setUTCHours(23, 59, 59, 999);
        dateFilter.criadaEm.lte = end;
      }
    }

    // Fetch all cards and their transactions for the event
    const [cartoes, movimentacoes, produtos] = await Promise.all([
      prisma.cartao.findMany({ where: { eventoId } }),
      prisma.movimentacao.findMany({
        where: { 
          cartao: { eventoId },
          ...(Object.keys(dateFilter).length > 0 ? dateFilter : {})
        },
        include: {
          cartao: { include: { cliente: true } },
          produto: true,
          operador: true
        },
        orderBy: { criadaEm: 'desc' }
      }),
      prisma.produto.findMany({ where: { eventoId } })
    ]);

    const totalRecarregado = movimentacoes.filter(m => m.tipo === 'RECARGA').reduce((s, m) => s + m.valor, 0);
    const totalDebito = movimentacoes.filter(m => m.tipo === 'DEBITO').reduce((s, m) => s + m.valor, 0);
    const totalEstorno = movimentacoes.filter(m => m.tipo === 'ESTORNO').reduce((s, m) => s + m.valor, 0);
    const saldoEmAberto = cartoes.reduce((s, c) => s + c.saldo, 0);
    const totalCartoes = cartoes.length;
    const totalPedidos = movimentacoes.filter(m => m.tipo === 'DEBITO').length;
    const ticketMedio = totalPedidos > 0 ? totalDebito / totalPedidos : 0;

    // Aggregations
    const vendasPorGrupoMap = {};
    const recebimentosMap = { Pix: 0, Cartão: 0, Dinheiro: 0, Débito: 0, Crédito: 0, Cortesia: 0 };
    const recebimentosQtd = { Pix: 0, Cartão: 0, Dinheiro: 0, Débito: 0, Crédito: 0, Cortesia: 0 };

    movimentacoes.forEach(m => {
      if (m.tipo === 'DEBITO' && m.produto) {
        const cat = m.produto.grupo || 'Outros';
        if (!vendasPorGrupoMap[cat]) {
          vendasPorGrupoMap[cat] = { value: 0, qtd: 0 };
        }
        vendasPorGrupoMap[cat].value += m.valor;
        vendasPorGrupoMap[cat].qtd += 1;
      }

      if (m.tipo === 'RECARGA') {
        const descLower = (m.descricao || '').toLowerCase();
        let metodo = 'Pix'; // default
        
        if (descLower.includes('debito_offline') || descLower.includes('débito')) {
          metodo = 'Débito';
        } else if (descLower.includes('credito_offline') || descLower.includes('crédito')) {
          metodo = 'Crédito';
        } else if (descLower.includes('cartão') || descLower.includes('cartao') || descLower.includes('wallet')) {
          metodo = 'Cartão';
        } else if (descLower.includes('dinheiro')) {
          metodo = 'Dinheiro';
        } else if (descLower.includes('cortesia')) {
          metodo = 'Cortesia';
        }

        recebimentosMap[metodo] += m.valor;
        recebimentosQtd[metodo] += 1;
      }
    });

    const vendasPorGrupo = Object.keys(vendasPorGrupoMap).map(k => ({
      name: k,
      value: vendasPorGrupoMap[k].value,
      qtd: vendasPorGrupoMap[k].qtd
    }));

    const vendasPorProdutoMap = {};
    movimentacoes.forEach(m => {
      if (m.tipo === 'DEBITO' && m.produto) {
        const prodName = m.produto.nome || 'Desconhecido';
        if (!vendasPorProdutoMap[prodName]) {
          vendasPorProdutoMap[prodName] = { value: 0, qtd: 0 };
        }
        vendasPorProdutoMap[prodName].value += m.valor;
        vendasPorProdutoMap[prodName].qtd += 1;
      }
    });

    const vendasPorProduto = Object.keys(vendasPorProdutoMap).map(k => ({
      name: k,
      value: vendasPorProdutoMap[k].value,
      qtd: vendasPorProdutoMap[k].qtd
    })).sort((a,b) => b.value - a.value);

    const recebimentos = Object.keys(recebimentosMap).map(k => ({
      name: k,
      value: recebimentosMap[k],
      qtd: recebimentosQtd[k]
    }));

    // Grouping by hour
    const horasMap = {};
    movimentacoes.forEach(m => {
      if (m.tipo === 'DEBITO') {
        const hour = new Date(m.criadaEm).getHours() + 'h';
        horasMap[hour] = (horasMap[hour] || 0) + m.valor;
      }
    });
    const vendasPorHora = Object.keys(horasMap).map(h => ({
      hora: h,
      valor: horasMap[h]
    })).sort((a,b) => parseInt(a.hora) - parseInt(b.hora));

    const vendasMestre = movimentacoes.map(m => ({
      id: m.id,
      data: new Date(m.criadaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      hora: new Date(m.criadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      cliente: m.cartao?.cliente?.nome || '—',
      produto: m.produto?.nome || (m.tipo === 'RECARGA' ? 'Recarga Cartão' : m.tipo),
      categoria: m.produto?.grupo || m.tipo,
      operador: m.operador?.nome || m.operadorNome || 'Online/Excluído',
      pagto: m.tipo === 'RECARGA' ? 'Entrada' : (m.tipo === 'ESTORNO' ? 'Estorno/Devolução' : 'Saldo Consumo'),
      valor: m.valor
    }));

    return NextResponse.json({
      summary: {
        totalRecarregado,
        totalDebito,
        totalEstorno,
        saldoEmAberto,
        totalCartoes,
        totalPedidos,
        ticketMedio
      },
      vendasPorGrupo,
      vendasPorProduto,
      vendasPorHora,
      recebimentos,
      vendasMestre
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
