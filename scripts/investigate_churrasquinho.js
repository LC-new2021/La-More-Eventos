const { Client } = require('pg');
const connectionString = "postgresql://postgres:VWuLyODchlYWoIlzMuePOphoNvoiBUDp@kodama.proxy.rlwy.net:47379/railway";

async function investigateChurrasquinho() {
  const client = new Client({ connectionString });
  await client.connect();

  const eventoId = 'cmsp048gm00003nc8qfpmzenp'; // EC 34 Ceilândia

  console.log("=== 1. VERIFICANDO TODOS OS PRODUTOS CADASTRADOS DO EVENTO ===");
  const produtos = await client.query(`
    SELECT * FROM "Produto" WHERE "eventoId" = $1 ORDER BY nome ASC
  `, [eventoId]);
  console.table(produtos.rows.map(p => ({
    id: p.id,
    nome: p.nome,
    preco: p.preco,
    grupo: p.grupo,
    precoVariavel: p.precoVariavel,
    ativo: p.ativo
  })));

  console.log("\n=== 2. VERIFICANDO TODAS AS MOVIMENTAÇÕES DE CHURRASQUINHO ===");
  const movsChurras = await client.query(`
    SELECT m.id, m.valor, m.tipo, m.descricao, m."criadaEm", m."operadorNome",
           p.nome as prod_nome, p.preco as prod_cad_preco, p.id as prod_id,
           c.codigo as cartao_codigo, cl.nome as cliente_nome
    FROM "Movimentacao" m
    LEFT JOIN "Produto" p ON m."produtoId" = p.id
    LEFT JOIN "Cartao" c ON m."cartaoId" = c.id
    LEFT JOIN "Cliente" cl ON c."clienteId" = cl.id
    WHERE c."eventoId" = $1 AND (p.nome ILIKE '%churras%' OR m.descricao ILIKE '%churras%')
    ORDER BY m."criadaEm" ASC
  `, [eventoId]);

  console.log(`Total de transações de churrasquinho encontradas: ${movsChurras.rows.length}`);

  // Agrupando por valores cobrados
  const valoresMap = {};
  movsChurras.rows.forEach(m => {
    const v = parseFloat(m.valor);
    const prod = m.prod_nome || m.descricao;
    const key = `${prod} | R$ ${v.toFixed(2)}`;
    if (!valoresMap[key]) valoresMap[key] = { count: 0, total: 0, produto: prod, valorUnitario: v };
    valoresMap[key].count++;
    valoresMap[key].total += v;
  });

  console.log("\n=== 3. AGRUPAMENTO POR VALOR COBRADO NAS TRANSAÇÕES ===");
  console.table(Object.values(valoresMap));

  console.log("\n=== 4. AMOSTRA DE TRANSAÇÕES INDIVIDUAIS DE CHURRASQUINHO ===");
  console.table(movsChurras.rows.slice(0, 20).map(m => ({
    DataHora: m.criadaEm,
    Produto: m.prod_nome || m.descricao,
    ValorDebitado: m.valor,
    PrecoCadastro: m.prod_cad_preco,
    Cartao: m.cartao_codigo,
    Cliente: m.cliente_nome,
    Operador: m.operadorNome
  })));

  console.log("\n=== 5. INVESTIGAÇÃO DE TODOS OS PRODUTOS VENDIDOS NO EVENTO E SEUS VALORES UNITÁRIOS DE DÉBITO ===");
  const allDebitos = await client.query(`
    SELECT m.valor, p.nome, p.preco as preco_cadastro, p.grupo
    FROM "Movimentacao" m
    LEFT JOIN "Produto" p ON m."produtoId" = p.id
    JOIN "Cartao" c ON m."cartaoId" = c.id
    WHERE c."eventoId" = $1 AND m.tipo = 'DEBITO'
  `, [eventoId]);

  const analiseGeral = {};
  allDebitos.rows.forEach(d => {
    const nome = d.nome || 'Sem Produto';
    const v = parseFloat(d.valor);
    const pCad = parseFloat(d.preco_cadastro) || 0;
    if (!analiseGeral[nome]) {
      analiseGeral[nome] = {
        precoCadastro: pCad,
        valoresCobrados: {},
        qtdTotalTransacoes: 0,
        totalFaturado: 0
      };
    }
    analiseGeral[nome].qtdTotalTransacoes++;
    analiseGeral[nome].totalFaturado += v;
    analiseGeral[nome].valoresCobrados[v] = (analiseGeral[nome].valoresCobrados[v] || 0) + 1;
  });

  console.log("\nRESUMO GERAL DE ITENS COM PREÇO DE CADASTRO VS VALORES DEBITADOS:");
  Object.keys(analiseGeral).forEach(k => {
    console.log(`\nPRODUTO: ${k} (Preço Cadastrado: R$ ${analiseGeral[k].precoCadastro})`);
    console.log(`- Total de transações: ${analiseGeral[k].qtdTotalTransacoes} | Faturamento Total: R$ ${analiseGeral[k].totalFaturado.toFixed(2)}`);
    console.log(`- Distribuição de valores cobrados por transação:`, analiseGeral[k].valoresCobrados);
  });

  await client.end();
}

investigateChurrasquinho().catch(console.error);
