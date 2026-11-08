const { Client } = require('pg');
const connectionString = "postgresql://postgres:VWuLyODchlYWoIlzMuePOphoNvoiBUDp@kodama.proxy.rlwy.net:47379/railway";

async function calculateTrueQuantities() {
  const client = new Client({ connectionString });
  await client.connect();

  const eventoId = 'cmsp048gm00003nc8qfpmzenp'; // EC 34 Ceilândia

  // Buscar todas as movimentações de débito do evento com dados do produto
  const res = await client.query(`
    SELECT m.id, m.valor, m.descricao, m."criadaEm", m."operadorNome",
           p.id as prod_id, p.nome as prod_nome, p.preco as prod_preco_cadastro, p.grupo as prod_grupo
    FROM "Movimentacao" m
    JOIN "Cartao" c ON m."cartaoId" = c.id
    LEFT JOIN "Produto" p ON m."produtoId" = p.id
    WHERE c."eventoId" = $1 AND m.tipo = 'DEBITO'
    ORDER BY m."criadaEm" ASC
  `, [eventoId]);

  console.log(`Total de movimentações de débito: ${res.rows.length}`);

  // Agrupador por produto
  const itens = {};

  res.rows.forEach(m => {
    const nome = m.prod_nome || m.descricao || 'Item sem nome';
    const grupo = m.prod_grupo || 'Geral';
    const pUnit = parseFloat(m.prod_preco_cadastro) || 0;
    const vTotalDebitado = parseFloat(m.valor) || 0;

    // Se o preço cadastrado for > 0, unidades = valor total debitado / preco unitário cadastrado
    // Ex: Se R$ 20 e preço é R$ 10 -> 2 unidades
    const qtdReal = pUnit > 0 ? (vTotalDebitado / pUnit) : 1;

    if (!itens[nome]) {
      itens[nome] = {
        produto: nome,
        grupo: grupo,
        precoUnitario: pUnit,
        totalTransacoesBipadas: 0,
        unidadesReaisVendidas: 0,
        totalFaturado: 0
      };
    }

    itens[nome].totalTransacoesBipadas += 1;
    itens[nome].unidadesReaisVendidas += qtdReal;
    itens[nome].totalFaturado += vTotalDebitado;
  });

  const tabela = Object.values(itens).map(it => ({
    Produto: it.produto,
    Categoria: it.grupo,
    'Preço Unit. (R$)': `R$ ${it.precoUnitario.toFixed(2)}`,
    'Transações (Vezes que Bipou)': it.totalTransacoesBipadas,
    'UNIDADES REAIS VENDIDAS': Math.round(it.unidadesReaisVendidas * 100) / 100,
    'Total Faturado (R$)': `R$ ${it.totalFaturado.toFixed(2)}`
  })).sort((a,b) => b['UNIDADES REAIS VENDIDAS'] - a['UNIDADES REAIS VENDIDAS']);

  console.log("\n=== CONTAGEM CORRETA DE UNIDADES FÍSICAS REAIS VENDIDAS ===");
  console.table(tabela);

  // Totais consolidados
  let totalTransacoes = 0;
  let totalUnidadesFisicas = 0;
  let totalFaturadoGeral = 0;

  Object.values(itens).forEach(it => {
    totalTransacoes += it.totalTransacoesBipadas;
    totalUnidadesFisicas += it.unidadesReaisVendidas;
    totalFaturadoGeral += it.totalFaturado;
  });

  console.log(`\n======================================================`);
  console.log(`TOTAL DE TRANSAÇÕES BIPADAS: ${totalTransacoes}`);
  console.log(`TOTAL DE UNIDADES FÍSICAS REAIS VENDIDAS: ${totalUnidadesFisicas.toFixed(0)} unidades`);
  console.log(`FATURAMENTO TOTAL DO BAR: R$ ${totalFaturadoGeral.toFixed(2)}`);
  console.log(`======================================================`);

  // Análise Específica do Churrasquinho:
  const churrasNormal = itens['Churrasquinho'];
  const churrasPromo = itens['Promo churrasquinho'];

  console.log("\n=== DETALHAMENTO EXCLUSIVO DO CHURRASQUINHO ===");
  if (churrasNormal) {
    console.log(`• Churrasquinho Normal (R$ 10,00):`);
    console.log(`  - Vezes que o cartão foi bipado: ${churrasNormal.totalTransacoesBipadas} vezes`);
    console.log(`  - UNIDADES FÍSICAS REAIS ENTREGUES: ${churrasNormal.unidadesReaisVendidas} espetinhos`);
    console.log(`  - Faturamento Total: R$ ${churrasNormal.totalFaturado.toFixed(2)} (464 x R$ 10 = R$ 4.640,00)`);
  }
  if (churrasPromo) {
    console.log(`• Promoção Churrasquinho (R$ 8,00):`);
    console.log(`  - Vezes que o cartão foi bipado: ${churrasPromo.totalTransacoesBipadas} vezes`);
    console.log(`  - UNIDADES FÍSICAS REAIS ENTREGUES: ${churrasPromo.unidadesReaisVendidas} espetinhos`);
    console.log(`  - Faturamento Total: R$ ${churrasPromo.totalFaturado.toFixed(2)} (43 x R$ 8 = R$ 344,00)`);
  }
  const somaChurrasUnidades = (churrasNormal?.unidadesReaisVendidas || 0) + (churrasPromo?.unidadesReaisVendidas || 0);
  const somaChurrasFaturamento = (churrasNormal?.totalFaturado || 0) + (churrasPromo?.totalFaturado || 0);
  console.log(`\n👉 TOTAL GERAL DE CHURRASQUINHOS VENDIDOS NO EVENTO:`);
  console.log(`   ${somaChurrasUnidades} UNIDADES FÍSICAS (ESPETINHOS) = R$ ${somaChurrasFaturamento.toFixed(2)}`);

  await client.end();
}

calculateTrueQuantities().catch(console.error);
