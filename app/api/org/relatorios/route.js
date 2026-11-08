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

    // Fetch all cards (includingATIVO, ENCERRADO, CANCELADO), transactions, products, and operators
    const [evento, cartoes, movimentacoes, produtos, usuariosEvento] = await Promise.all([
      prisma.evento.findUnique({ where: { id: eventoId }, select: { id: true, nome: true } }),
      prisma.cartao.findMany({
        where: { eventoId },
        include: { cliente: true },
      }),
      prisma.movimentacao.findMany({
        where: {
          cartao: { eventoId },
          tipo: { in: ['RECARGA', 'DEBITO', 'ESTORNO'] },
          ...(Object.keys(dateFilter).length > 0 ? dateFilter : {}),
        },
        include: {
          cartao: { include: { cliente: true } },
          produto: true,
          operador: true,
        },
        orderBy: { criadaEm: 'desc' },
      }),
      prisma.produto.findMany({
        where: { eventoId },
        include: {
          movimentacoes: {
            where: { tipo: 'HISTORICO_PRECO' },
            orderBy: { criadaEm: 'asc' },
          },
        },
      }),
      prisma.usuario.findMany({
        where: { eventoId },
        select: { id: true, nome: true, email: true, role: true, ativo: true },
      }),
    ]);

    const totalRecarregado = movimentacoes
      .filter((m) => m.tipo === 'RECARGA')
      .reduce((s, m) => s + m.valor, 0);
    const totalDebito = movimentacoes
      .filter((m) => m.tipo === 'DEBITO')
      .reduce((s, m) => s + m.valor, 0);
    const totalEstorno = movimentacoes
      .filter((m) => m.tipo === 'ESTORNO')
      .reduce((s, m) => s + m.valor, 0);
    const saldoEmAberto = cartoes.reduce((s, c) => s + c.saldo, 0);
    const totalCartoes = cartoes.length;
    const totalPedidos = movimentacoes.filter((m) => m.tipo === 'DEBITO').length;
    const ticketMedio = totalPedidos > 0 ? totalDebito / totalPedidos : 0;

    // Aggregations
    const vendasPorGrupoMap = {};
    const recebimentosMap = { Pix: 0, Cartão: 0, Dinheiro: 0, Débito: 0, Crédito: 0, Cortesia: 0 };
    const recebimentosQtd = { Pix: 0, Cartão: 0, Dinheiro: 0, Débito: 0, Crédito: 0, Cortesia: 0 };

    const extrairUnidades = (m) => {
      const match = String(m.descricao || '').match(/^(\d+)x\s+/i);
      if (match && parseInt(match[1], 10) > 0) {
        return parseInt(match[1], 10);
      }
      const precoUnit = parseFloat(m.produto?.preco) || 0;
      const valorDebito = parseFloat(m.valor) || 0;
      if (precoUnit > 0 && valorDebito > 0) {
        return Math.max(1, Math.round((valorDebito / precoUnit) * 100) / 100);
      }
      return 1;
    };

    const extrairNomeProdutoFallback = (m) => {
      if (m.produto?.nome) return m.produto.nome;
      const desc = String(m.descricao || '')
        .replace(/^(\d+)x\s+/i, '')
        .replace(/\s*\(Cortesia:.*$/i, '')
        .trim();
      return desc || 'Item Excluído';
    };

    movimentacoes.forEach((m) => {
      if (m.tipo === 'DEBITO') {
        const cat = m.produto?.grupo || 'Outros';
        if (!vendasPorGrupoMap[cat]) {
          vendasPorGrupoMap[cat] = { value: 0, qtd: 0 };
        }
        vendasPorGrupoMap[cat].value += m.valor;
        vendasPorGrupoMap[cat].qtd += extrairUnidades(m);
      }

      if (m.tipo === 'RECARGA') {
        const descLower = (m.descricao || '').toLowerCase();
        let metodo = 'Pix';

        if (descLower.includes('debito_offline') || descLower.includes('débito')) {
          metodo = 'Débito';
        } else if (descLower.includes('credito_offline') || descLower.includes('crédito')) {
          metodo = 'Crédito';
        } else if (
          descLower.includes('cartão') ||
          descLower.includes('cartao') ||
          descLower.includes('wallet')
        ) {
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

    const vendasPorGrupo = Object.keys(vendasPorGrupoMap).map((k) => ({
      name: k,
      value: vendasPorGrupoMap[k].value,
      qtd: vendasPorGrupoMap[k].qtd,
    }));

    // Map all products (active, deactivated, and soft-deleted) so none are ever missing
    const vendasPorProdutoMap = {};
    produtos.forEach((p) => {
      const isDeleted = String(p.atualizadoPorNome || '').startsWith('[EXCLUIDO]');
      const statusProduto = isDeleted ? 'EXCLUÍDO' : p.ativo ? 'ATIVO' : 'DESATIVADO';
      const hist = Array.isArray(p.movimentacoes)
        ? p.movimentacoes.map((hm) => {
            try {
              const parsed = JSON.parse(hm.descricao || '{}');
              return { de: parsed.de, para: parsed.para, por: parsed.por, data: hm.criadaEm };
            } catch {
              return { de: null, para: hm.valor, por: hm.operadorNome, data: hm.criadaEm };
            }
          })
        : [];

      const key = p.id;
      vendasPorProdutoMap[key] = {
        id: p.id,
        name: p.nome,
        grupo: p.grupo || 'Geral',
        precoUnitario: parseFloat(p.preco) || 0,
        statusProduto,
        historicoPrecos: hist,
        value: 0,
        qtd: 0,
        pedidos: 0,
      };
    });

    movimentacoes.forEach((m) => {
      if (m.tipo === 'DEBITO') {
        const prodKey = m.produto?.id || `deleted_${extrairNomeProdutoFallback(m)}`;
        const prodName = extrairNomeProdutoFallback(m);
        const isDeleted = m.produto
          ? String(m.produto.atualizadoPorNome || '').startsWith('[EXCLUIDO]')
          : true;
        const statusProduto = !m.produto
          ? 'EXCLUÍDO'
          : isDeleted
          ? 'EXCLUÍDO'
          : m.produto.ativo
          ? 'ATIVO'
          : 'DESATIVADO';

        const unidadesCalculadas = extrairUnidades(m);
        const valorDebito = parseFloat(m.valor) || 0;
        const precoUnit =
          parseFloat(m.produto?.preco) ||
          (unidadesCalculadas > 0 ? valorDebito / unidadesCalculadas : valorDebito) ||
          0;

        if (!vendasPorProdutoMap[prodKey]) {
          vendasPorProdutoMap[prodKey] = {
            id: prodKey,
            name: prodName,
            value: 0,
            qtd: 0,
            pedidos: 0,
            precoUnitario: precoUnit,
            grupo: m.produto?.grupo || 'Outros',
            statusProduto,
            historicoPrecos: [],
          };
        }
        vendasPorProdutoMap[prodKey].value += valorDebito;
        vendasPorProdutoMap[prodKey].qtd += unidadesCalculadas;
        vendasPorProdutoMap[prodKey].pedidos += 1;
      }
    });

    // Include all sold products AND any deactivated/deleted/price-changed products for complete visibility
    const vendasPorProduto = Object.values(vendasPorProdutoMap)
      .filter((p) => p.pedidos > 0 || p.statusProduto !== 'ATIVO' || (p.historicoPrecos || []).length > 0)
      .map((p) => ({
        ...p,
        qtd: Math.round(p.qtd * 100) / 100,
      }))
      .sort((a, b) => b.value - a.value || b.qtd - a.qtd);

    // Resumo detalhado por Operador / Usuário (incluindo ativos, desativados e excluídos)
    const operadoresMap = {};
    usuariosEvento.forEach((u) => {
      operadoresMap[u.id] = {
        id: u.id,
        nome: u.nome,
        email: u.email,
        role: u.role,
        status: u.ativo ? 'ATIVO' : 'DESATIVADO',
        totalRecargas: 0,
        qtdRecargas: 0,
        totalVendasBar: 0,
        qtdVendasBar: 0,
        totalEstornos: 0,
        qtdEstornos: 0,
      };
    });

    movimentacoes.forEach((m) => {
      const opKey = m.operadorId || `op_${m.operadorNome || 'Sistema / Online'}`;
      if (!operadoresMap[opKey]) {
        const isExcluido = String(m.operadorNome || '').includes('Excluído') || (!m.operador && m.operadorNome);
        operadoresMap[opKey] = {
          id: opKey,
          nome: m.operador?.nome || m.operadorNome || 'Sistema / Auto-atendimento Online',
          email: m.operador?.email || '—',
          role: m.operador?.role || (m.tipo === 'DEBITO' ? 'OPERADOR_BAR' : 'CAIXA'),
          status: m.operador ? (m.operador.ativo ? 'ATIVO' : 'DESATIVADO') : (isExcluido ? 'EXCLUÍDO' : 'SISTEMA'),
          totalRecargas: 0,
          qtdRecargas: 0,
          totalVendasBar: 0,
          qtdVendasBar: 0,
          totalEstornos: 0,
          qtdEstornos: 0,
        };
      }
      if (m.tipo === 'RECARGA') {
        operadoresMap[opKey].totalRecargas += m.valor;
        operadoresMap[opKey].qtdRecargas += 1;
      } else if (m.tipo === 'DEBITO') {
        operadoresMap[opKey].totalVendasBar += m.valor;
        operadoresMap[opKey].qtdVendasBar += 1;
      } else if (m.tipo === 'ESTORNO') {
        operadoresMap[opKey].totalEstornos += m.valor;
        operadoresMap[opKey].qtdEstornos += 1;
      }
    });

    const vendasPorOperador = Object.values(operadoresMap).sort(
      (a, b) => b.totalRecargas + b.totalVendasBar - (a.totalRecargas + a.totalVendasBar)
    );

    const recebimentos = Object.keys(recebimentosMap)
      .map((k) => ({
        name: k,
        value: recebimentosMap[k],
        qtd: recebimentosQtd[k],
      }))
      .filter((r) => r.value > 0);

    // Grouping by hour
    const horasMap = {};
    movimentacoes.forEach((m) => {
      if (m.tipo === 'DEBITO') {
        const hourStr = new Date(m.criadaEm).toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
        });
        const hour = parseInt(hourStr, 10) + 'h';
        horasMap[hour] = (horasMap[hour] || 0) + m.valor;
      }
    });
    const vendasPorHora = Object.keys(horasMap)
      .map((h) => ({
        hora: h,
        valor: horasMap[h],
      }))
      .sort((a, b) => parseInt(a.hora) - parseInt(b.hora));

    const vendasMestre = movimentacoes.map((m) => {
      const qtd = m.tipo === 'DEBITO' ? extrairUnidades(m) : 1;
      const precoUnit = qtd > 0 ? m.valor / qtd : m.valor;
      const nomeBaseProd = extrairNomeProdutoFallback(m);

      const isProdDeleted = m.produto
        ? String(m.produto.atualizadoPorNome || '').startsWith('[EXCLUIDO]')
        : m.tipo === 'DEBITO';
      const prodStatusTag =
        m.tipo === 'DEBITO'
          ? isProdDeleted
            ? ' [Produto Excluído]'
            : m.produto && !m.produto.ativo
            ? ' [Produto Desativado]'
            : ''
          : '';

      const labelProduto =
        m.tipo === 'DEBITO'
          ? `${qtd}x ${nomeBaseProd}${prodStatusTag} (${qtd} un. × R$ ${precoUnit
              .toFixed(2)
              .replace('.', ',')})`
          : m.descricao || (m.tipo === 'RECARGA' ? 'Recarga Cartão' : m.tipo);

      const statusCartao = m.cartao?.status;
      const clienteSuffix =
        statusCartao === 'CANCELADO'
          ? ' (Excluído)'
          : statusCartao === 'ENCERRADO'
          ? ' (Desativado)'
          : '';

      const opNome = m.operador?.nome
        ? `${m.operador.nome}${!m.operador.ativo ? ' (Desativado)' : ''}`
        : m.operadorNome || 'Online/Sistema';

      return {
        id: m.id,
        data: new Date(m.criadaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        hora: new Date(m.criadaEm).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        }),
        cliente: `${m.cartao?.cliente?.nome || '—'}${clienteSuffix}`,
        statusCliente: statusCartao || 'ATIVO',
        produto: labelProduto,
        quantidade: qtd,
        precoUnitario: precoUnit,
        categoria: m.produto?.grupo || m.tipo,
        operador: opNome,
        pagto:
          m.tipo === 'RECARGA'
            ? 'Entrada'
            : m.tipo === 'ESTORNO'
            ? 'Estorno/Devolução'
            : 'Saldo Consumo',
        valor: m.valor,
      };
    });

    // Consolidação de Cortesias por Pessoa / Cartão Único
    const pessoasCortesiaMap = {};

    movimentacoes.forEach((m) => {
      if (m.tipo === 'RECARGA') {
        const descLower = (m.descricao || '').toLowerCase();
        if (descLower.includes('cortesia')) {
          const key = m.cartaoId || m.cartao?.codigo || m.id;
          if (!pessoasCortesiaMap[key]) {
            pessoasCortesiaMap[key] = {
              id: key,
              cartaoId: m.cartaoId,
              cartaoCodigo: m.cartao?.codigo || '—',
              cartaoStatus: m.cartao?.status || 'ATIVO',
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
              devolucoes: [],
            };
          }
        }
      }
    });

    movimentacoes.forEach((m) => {
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
            data: new Date(m.criadaEm).toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            }),
            hora: new Date(m.criadaEm).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo',
            }),
            valor: m.valor,
            tipoRecarga: isCortesia ? 'Cortesia' : 'Recarga Própria / Paga',
            operador: m.operador?.nome || m.operadorNome || 'Sistema / Caixa',
            descricao: m.descricao || (isCortesia ? 'Recarga Cortesia' : 'Recarga'),
            criadaEm: m.criadaEm,
          });
        } else if (m.tipo === 'DEBITO') {
          pessoasCortesiaMap[key].totalConsumido += m.valor;
          const qtdConsumo = extrairUnidades(m);
          const unitConsumo = qtdConsumo > 0 ? m.valor / qtdConsumo : m.valor;
          const nomeProd = extrairNomeProdutoFallback(m);
          pessoasCortesiaMap[key].consumos.push({
            id: m.id,
            data: new Date(m.criadaEm).toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            }),
            hora: new Date(m.criadaEm).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo',
            }),
            produtoNome: `${qtdConsumo}x ${nomeProd} (${qtdConsumo} un. × R$ ${unitConsumo
              .toFixed(2)
              .replace('.', ',')})`,
            quantidade: qtdConsumo,
            precoUnitario: unitConsumo,
            produtoGrupo: m.produto?.grupo || 'Outros',
            valor: m.valor,
            operador: m.operador?.nome || m.operadorNome || 'Bar / Atendente',
            criadaEm: m.criadaEm,
          });
        } else if (m.tipo === 'ESTORNO') {
          pessoasCortesiaMap[key].totalDevolvido += m.valor;
          pessoasCortesiaMap[key].devolucoes.push({
            id: m.id,
            data: new Date(m.criadaEm).toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            }),
            hora: new Date(m.criadaEm).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo',
            }),
            valor: m.valor,
            operador: m.operador?.nome || m.operadorNome || 'Caixa / Devolução',
            descricao: m.descricao || 'Devolução de Saldo',
            criadaEm: m.criadaEm,
          });
        }
      }
    });

    const cortesiasConsolidadas = Object.values(pessoasCortesiaMap)
      .map((p) => {
        const totalCreditosCartao = p.totalCortesiaConcedida + p.totalRecargasPagas;
        const saldoRestanteCalculado = Math.max(
          0,
          totalCreditosCartao - p.totalConsumido - p.totalDevolvido
        );
        return {
          ...p,
          totalCreditosCartao,
          saldoRestante: saldoRestanteCalculado,
          primeiraRecargaData: p.recargas[0]?.data || '',
          primeiraRecargaHora: p.recargas[0]?.hora || '',
          operadorPrincipal: p.recargas.map((r) => r.operador).filter(Boolean)[0] || 'Sistema',
        };
      })
      .sort((a, b) => b.totalCortesiaConcedida - a.totalCortesiaConcedida);

    const totalCortesiasValor = cortesiasConsolidadas.reduce(
      (acc, c) => acc + c.totalCortesiaConcedida,
      0
    );
    const totalCortesiasConsumido = cortesiasConsolidadas.reduce(
      (acc, c) => acc + c.totalConsumido,
      0
    );
    const totalCortesiasDevolvido = cortesiasConsolidadas.reduce(
      (acc, c) => acc + c.totalDevolvido,
      0
    );
    const totalCortesiasCartoesQtd = cortesiasConsolidadas.length;

    return NextResponse.json({
      eventoNome: evento?.nome || 'Evento',
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
        totalCortesiasCartoesQtd,
      },
      vendasPorGrupo,
      vendasPorProduto,
      vendasPorOperador,
      vendasPorHora,
      recebimentos,
      vendasMestre,
      cortesiasConsolidadas,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
