const { Client } = require('pg');

const connectionString = "postgresql://postgres:VWuLyODchlYWoIlzMuePOphoNvoiBUDp@kodama.proxy.rlwy.net:47379/railway";

async function auditProduction() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("CONEXAO BEM SUCEDIDA COM O POSTGRES DO RAILWAY!");

    // 1. Tabelas existentes
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log("\nTabelas no banco:", tablesRes.rows.map(r => r.table_name));

    // 2. Listar Eventos
    const eventosRes = await client.query(`SELECT * FROM "Evento"`);
    console.log("\n=== EVENTOS CADASTRADOS ===");
    console.table(eventosRes.rows.map(e => ({
      id: e.id,
      nome: e.nome,
      data: e.data,
      status: e.status,
      modoOperacao: e.modoOperacao
    })));

    for (const ev of eventosRes.rows) {
      console.log(`\n===============================================================`);
      console.log(`AUDITORIA DO EVENTO: ${ev.nome} (ID: ${ev.id})`);
      console.log(`Data do Evento: ${ev.data} | Status: ${ev.status}`);
      console.log(`===============================================================`);

      // Contagem geral
      const cartoesRes = await client.query(`
        SELECT c.*, cl.nome as cliente_nome, cl.cpf as cliente_cpf, cl.celular as cliente_celular
        FROM "Cartao" c
        LEFT JOIN "Cliente" cl ON c."clienteId" = cl.id
        WHERE c."eventoId" = $1
      `, [ev.id]);

      const movsRes = await client.query(`
        SELECT m.*, 
               p.nome as produto_nome, p.preco as produto_preco, p.grupo as produto_grupo,
               c.codigo as cartao_codigo, c.saldo as cartao_saldo,
               cl.nome as cliente_nome, cl.cpf as cliente_cpf,
               u.nome as operador_nome_db
        FROM "Movimentacao" m
        LEFT JOIN "Cartao" c ON m."cartaoId" = c.id
        LEFT JOIN "Cliente" cl ON c."clienteId" = cl.id
        LEFT JOIN "Produto" p ON m."produtoId" = p.id
        LEFT JOIN "Usuario" u ON m."operadorId" = u.id
        WHERE c."eventoId" = $1 OR p."eventoId" = $1
        ORDER BY m."criadaEm" ASC
      `, [ev.id]);

      console.log(`\nTOTAL DE CARTÕES CADASTRADOS: ${cartoesRes.rows.length}`);
      console.log(`TOTAL DE MOVIMENTAÇÕES REGISTRADAS: ${movsRes.rows.length}`);

      let totalRecargas = 0;
      let totalRecargasCortesias = 0;
      let totalRecargasPagas = 0;
      let totalDebitos = 0;
      let totalEstornos = 0;
      let saldoTotalRestanteCartoes = cartoesRes.rows.reduce((sum, c) => sum + (parseFloat(c.saldo) || 0), 0);

      const porFormaPagto = {};
      const porProduto = {};
      const porOperador = {};
      const porHora = {};

      movsRes.rows.forEach(m => {
        const val = parseFloat(m.valor) || 0;
        const tipo = m.tipo;
        const desc = m.descricao || '';
        const descLower = desc.toLowerCase();

        // Agrupamento por Hora
        const dataHora = new Date(m.criadaEm);
        const horaStr = dataHora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit' }) + 'h';
        if (!porHora[horaStr]) porHora[horaStr] = { recargas: 0, consumo: 0, estorno: 0 };

        if (tipo === 'RECARGA') {
          totalRecargas += val;
          porHora[horaStr].recargas += val;

          let forma = 'Pix / Outro';
          if (descLower.includes('cortesia')) {
            forma = 'Cortesia';
            totalRecargasCortesias += val;
          } else if (descLower.includes('debito_offline') || descLower.includes('débito')) {
            forma = 'Cartão Débito';
            totalRecargasPagas += val;
          } else if (descLower.includes('credito_offline') || descLower.includes('crédito')) {
            forma = 'Cartão Crédito';
            totalRecargasPagas += val;
          } else if (descLower.includes('dinheiro')) {
            forma = 'Dinheiro';
            totalRecargasPagas += val;
          } else {
            forma = 'Pix / Gateway';
            totalRecargasPagas += val;
          }

          if (!porFormaPagto[forma]) porFormaPagto[forma] = { qtd: 0, total: 0 };
          porFormaPagto[forma].qtd += 1;
          porFormaPagto[forma].total += val;
        } else if (tipo === 'DEBITO') {
          totalDebitos += val;
          porHora[horaStr].consumo += val;

          const prodNome = m.produto_nome || m.descricao || 'Produto sem cadastro';
          const prodGrupo = m.produto_grupo || 'Geral';
          const prodPreco = m.produto_preco || val;

          if (!porProduto[prodNome]) {
            porProduto[prodNome] = {
              grupo: prodGrupo,
              precoUnit: parseFloat(prodPreco),
              qtd: 0,
              totalFaturado: 0
            };
          }
          porProduto[prodNome].qtd += 1;
          porProduto[prodNome].totalFaturado += val;

          const op = m.operadorNome || m.operador_nome_db || 'Não Identificado';
          if (!porOperador[op]) porOperador[op] = { itensVendidos: 0, total: 0 };
          porOperador[op].itensVendidos += 1;
          porOperador[op].total += val;
        } else if (tipo === 'ESTORNO') {
          totalEstornos += val;
          porHora[horaStr].estorno += val;
        }
      });

      console.log(`\n---------------------------------------------------------------`);
      console.log(`1. CONCILIAÇÃO FINANCEIRA GERAL`);
      console.log(`---------------------------------------------------------------`);
      console.log(`Total Recargas Pagas (Dinheiro/Cartão/Pix):  R$ ${totalRecargasPagas.toFixed(2)}`);
      console.log(`Total Recargas Cortesia (Crédito Bônus):      R$ ${totalRecargasCortesias.toFixed(2)}`);
      console.log(`TOTAL GERAL DE CRÉDITOS INSERIDOS (Entradas): R$ ${totalRecargas.toFixed(2)}`);
      console.log(`TOTAL CONSUMIDO NOS BARES (Saídas/Vendas):    R$ ${totalDebitos.toFixed(2)}`);
      console.log(`TOTAL ESTORNADO / DEVOLVIDO:                  R$ ${totalEstornos.toFixed(2)}`);
      console.log(`SALDO ATUAL RESTANTE NOS CARTÕES:             R$ ${saldoTotalRestanteCartoes.toFixed(2)}`);

      const balanco = totalRecargas - totalDebitos - totalEstornos;
      console.log(`\nPROVA REAL DOS CARTÕES:`);
      console.log(`Créditos Inseridos (${totalRecargas.toFixed(2)}) - Consumo (${totalDebitos.toFixed(2)}) - Estornos (${totalEstornos.toFixed(2)}) = R$ ${balanco.toFixed(2)}`);
      console.log(`Bate exatamente com a soma dos saldos dos cartões (R$ ${saldoTotalRestanteCartoes.toFixed(2)})? ${Math.abs(balanco - saldoTotalRestanteCartoes) < 0.05 ? '✅ 100% EXATO E CONCILIADO' : '❌ DIVERGÊNCIA DETECTADA'}`);

      console.log(`\n---------------------------------------------------------------`);
      console.log(`2. RELATÓRIO ANALÍTICO DE PRODUTOS VENDIDOS NO BAR`);
      console.log(`---------------------------------------------------------------`);
      const prodTable = Object.keys(porProduto).map(p => ({
        Produto: p,
        Grupo: porProduto[p].grupo,
        'Preço Unitário': `R$ ${porProduto[p].precoUnit.toFixed(2)}`,
        'Qtd Vendida (Un)': porProduto[p].qtd,
        'Total Bruto Faturado': `R$ ${porProduto[p].totalFaturado.toFixed(2)}`
      })).sort((a,b) => b['Qtd Vendida (Un)'] - a['Qtd Vendida (Un)']);
      console.table(prodTable);

      console.log(`\n---------------------------------------------------------------`);
      console.log(`3. RELATÓRIO POR FORMA DE PAGAMENTO (ENTRADA DE RECARGAS)`);
      console.log(`---------------------------------------------------------------`);
      const pagtoTable = Object.keys(porFormaPagto).map(f => ({
        'Método': f,
        'Qtd Transações': porFormaPagto[f].qtd,
        'Total Inserido': `R$ ${porFormaPagto[f].total.toFixed(2)}`
      }));
      console.table(pagtoTable);

      console.log(`\n---------------------------------------------------------------`);
      console.log(`4. DESEMPENHO POR OPERADOR / PONTO DE VENDA`);
      console.log(`---------------------------------------------------------------`);
      const opTable = Object.keys(porOperador).map(op => ({
        Operador: op,
        'Itens Lançados (Qtd)': porOperador[op].itensVendidos,
        'Total Faturado': `R$ ${porOperador[op].total.toFixed(2)}`
      }));
      console.table(opTable);

      console.log(`\n---------------------------------------------------------------`);
      console.log(`5. CONSUMO HORA A HORA (TIMELINE DO EVENTO)`);
      console.log(`---------------------------------------------------------------`);
      const horaTable = Object.keys(porHora).map(h => ({
        Hora: h,
        'Recargas (R$)': `R$ ${porHora[h].recargas.toFixed(2)}`,
        'Consumo Bar (R$)': `R$ ${porHora[h].consumo.toFixed(2)}`,
        'Estornos (R$)': `R$ ${porHora[h].estorno.toFixed(2)}`
      }));
      console.table(horaTable);

      // Verificação detalhada de cartões individuais
      console.log(`\n---------------------------------------------------------------`);
      console.log(`6. RESUMO DOS CARTÕES COM MAIOR SALDO / MOVIMENTAÇÃO`);
      console.log(`---------------------------------------------------------------`);
      const cartoesComSaldo = cartoesRes.rows.filter(c => parseFloat(c.saldo) > 0);
      console.log(`Cartões que ainda possuem saldo não gasto: ${cartoesComSaldo.length} cartões`);
      if (cartoesComSaldo.length > 0) {
        console.table(cartoesComSaldo.slice(0, 15).map(c => ({
          'Código': c.codigo,
          'Cliente': c.cliente_nome || 'Sem Nome',
          'CPF': c.cliente_cpf || 'N/A',
          'Saldo Sobrando': `R$ ${parseFloat(c.saldo).toFixed(2)}`,
          'Status': c.status
        })));
      }
    }
  } catch (err) {
    console.error("Erro na auditoria:", err);
  } finally {
    await client.end();
  }
}

auditProduction();
