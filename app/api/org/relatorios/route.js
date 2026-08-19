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
        const start = new Date(`${dataInicio}T00:00:00-03:00`);
        dateFilter.criadaEm.gte = start;
      }
      if (dataFim) {
        const end = new Date(`${dataFim}T23:59:59.999-03:00`);
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
        const precoUnit = parseFloat(m.produto.preco) || parseFloat(m.valor) || 1;
        const valorDebito = parseFloat(m.valor) || 0;
        const unidadesCalculadas = precoUnit > 0 ? (valorDebito / precoUnit) : 1;

        if (!vendasPorProdutoMap[prodName]) {
          vendasPorProdutoMap[prodName] = {
            value: 0,
            qtd: 0, // Unidades físicas reais vendidas
            pedidos: 0, // Vezes que foi bipado/transações
            precoUnitario: precoUnit,
            grupo: m.produto.grupo || 'Geral'
          };
        }
        vendasPorProdutoMap[prodName].value += valorDebito;
        vendasPorProdutoMap[prodName].qtd += unidadesCalculadas;
        vendasPorProdutoMap[prodName].pedidos += 1;
      }
    });

    const vendasPorProduto = Object.keys(vendasPorProdutoMap).map(k => ({
      name: k,
      grupo: vendasPorProdutoMap[k].grupo,
      precoUnitario: vendasPorProdutoMap[k].precoUnitario,
      value: vendasPorProdutoMap[k].value,
      qtd: Math.round(vendasPorProdutoMap[k].qtd * 100) / 100, // Unidades reais
      pedidos: vendasPorProdutoMap[k].pedidos // Transações/bipadas
    })).sort((a,b) => b.value - a.value);

    const recebimentos = Object.keys(recebimentosMap).map(k => ({
      name: k,
      value: recebimentosMap[k],
      qtd: recebimentosQtd[k]
    })).filter(r => r.value > 0);

    // Grouping by hour
    const horasMap = {};
    movimentacoes.forEach(m => {
      if (m.tipo === 'DEBITO') {
        const hourStr = new Date(m.criadaEm).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit' });
        const hour = parseInt(hourStr, 10) + 'h';
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

    // Consolidação de Cortesias por Pessoa / Cartão Único
    const pessoasCortesiaMap = {};
    const cartoesComCortesiaIds = new Set();

    // 1. Primeiro passo: identificar quais cartões receberam cortesia
    movimentacoes.forEach(m => {
      if (m.tipo === 'RECARGA') {
        const descLower = (m.descricao || '').toLowerCase();
        if (descLower.includes('cortesia')) {
          const key = m.cartaoId || m.cartao?.codigo || m.id;
          cartoesComCortesiaIds.add(key);
          if (!pessoasCortesiaMap[key]) {
            pessoasCortesiaMap[key] = {
              id: key,
              cartaoId: m.cartaoId,
              cartaoCodigo: m.cartao?.codigo || '—',
              clienteId: m.cartao?.cliente?.id,
              clienteNome: m.cartao?.cliente?.nome || 'Cliente Cortesia',
              clienteCpf: m.cartao?.cliente?.cpf || '',
              clienteCelular: m.cartao?.cliente?.celular || '',
              cartaoSaldoAtual: m.cartao?.saldo || 0,
              totalCortesiaConcedida: 0,
              totalRecargasPagas: 0,
              totalConsumido: 0,
              totalDevolvido: 0,
              recargas: [],
              consumos: [],
              devolucoes: []
            };
          }
        }
      }
    });

    // 2. Mapear todas as movimentações (recargas cortesia, recargas pagas, consumos e devoluções) para estes cartões
    movimentacoes.forEach(m => {
      const key = m.cartaoId || m.cartao?.codigo;
      if (key && pessoasCortesiaMap[key]) {
        if (m.tipo === 'RECARGA') {
          const descLower = (m.descricao || '').toLowerCase();
          const isCortesia = descLower.includes('cortesia');
          if (isCortesia) {
            pessoasCortesiaMap[key].totalCortesiaConcedida += m.valor;
          } else {
            pessoasCortesiaMap[key].totalRecargasPagas += m.valor;
          }
          pessoasCortesiaMap[key].recargas.push({
            id: m.id,
            data: new Date(m.criadaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            hora: new Date(m.criadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
            valor: m.valor,
            tipoRecarga: isCortesia ? 'Cortesia' : 'Recarga Própria / Paga',
            operador: m.operador?.nome || m.operadorNome || 'Sistema / Caixa',
            descricao: m.descricao || (isCortesia ? 'Recarga Cortesia' : 'Recarga'),
            criadaEm: m.criadaEm
          });
        } else if (m.tipo === 'DEBITO') {
          pessoasCortesiaMap[key].totalConsumido += m.valor;
          pessoasCortesiaMap[key].consumos.push({
            id: m.id,
            data: new Date(m.criadaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            hora: new Date(m.criadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
            produtoNome: m.produto?.nome || 'Item Geral',
            produtoGrupo: m.produto?.grupo || 'Outros',
            valor: m.valor,
            operador: m.operador?.nome || m.operadorNome || 'Bar / Atendente',
            criadaEm: m.criadaEm
          });
        } else if (m.tipo === 'ESTORNO') {
          pessoasCortesiaMap[key].totalDevolvido += m.valor;
          pessoasCortesiaMap[key].devolucoes.push({
            id: m.id,
            data: new Date(m.criadaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            hora: new Date(m.criadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
            valor: m.valor,
            operador: m.operador?.nome || m.operadorNome || 'Caixa / Devolução',
            descricao: m.descricao || 'Devolução de Saldo',
            criadaEm: m.criadaEm
          });
        }
      }
    });

    const cortesiasConsolidadas = Object.values(pessoasCortesiaMap).map(p => {
      const totalCreditosCartao = p.totalCortesiaConcedida + p.totalRecargasPagas;
      const saldoRestanteCalculado = Math.max(0, totalCreditosCartao - p.totalConsumido - p.totalDevolvido);
      return {
        ...p,
        totalCreditosCartao,
        saldoRestante: saldoRestanteCalculado,
        primeiraRecargaData: p.recargas[0]?.data || '',
        primeiraRecargaHora: p.recargas[0]?.hora || '',
        operadorPrincipal: p.recargas.map(r => r.operador).filter(Boolean)[0] || 'Sistema'
      };
    }).sort((a, b) => b.totalCortesiaConcedida - a.totalCortesiaConcedida);

    const totalCortesiasValor = cortesiasConsolidadas.reduce((acc, c) => acc + c.totalCortesiaConcedida, 0);
    const totalCortesiasConsumido = cortesiasConsolidadas.reduce((acc, c) => acc + c.totalConsumido, 0);
    const totalCortesiasDevolvido = cortesiasConsolidadas.reduce((acc, c) => acc + c.totalDevolvido, 0);
    const totalCortesiasCartoesQtd = cortesiasConsolidadas.length;

    return NextResponse.json({
      summary: {
        totalRecarregado,
        totalDebito,
        totalEstorno,
        saldoEmAberto,
        totalCartoes,
        totalPedidos,
        ticketMedio,
        totalCortesiasValor,
        totalCortesiasConsumido,
        totalCortesiasDevolvido,
        totalCortesiasCartoesQtd
      },
      vendasPorGrupo,
      vendasPorProduto,
      vendasPorHora,
      recebimentos,
      vendasMestre,
      cortesiasConsolidadas
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
