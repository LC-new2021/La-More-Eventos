const { Client } = require('pg');
const connectionString = "postgresql://postgres:VWuLyODchlYWoIlzMuePOphoNvoiBUDp@kodama.proxy.rlwy.net:47379/railway";

async function runComprehensiveAudit() {
  const client = new Client({ connectionString });
  await client.connect();

  const eventoId = 'cmsp048gm00003nc8qfpmzenp'; // EC 34 Ceilândia

  // 1. Buscar todos os débitos da festa no banco PostgreSQL
  const debitosRes = await client.query(`
    SELECT m.id, m.valor, m.tipo, m.descricao, m."criadaEm", m."operadorNome",
           p.id as prod_id, p.nome as prod_nome, p.preco as prod_preco, p.grupo as prod_grupo
    FROM "Movimentacao" m
    JOIN "Cartao" c ON m."cartaoId" = c.id
    LEFT JOIN "Produto" p ON m."produtoId" = p.id
    WHERE c."eventoId" = $1 AND m.tipo = 'DEBITO'
    ORDER BY m."criadaEm" ASC
  `, [eventoId]);

  console.log(`Total de movimentações de débito: ${debitosRes.rows.length}`);

  // Agrupar por produto exato registrado
  const rawProducts = {};
  debitosRes.rows.forEach(d => {
    const nome = d.prod_nome || d.descricao || 'Sem Nome';
    const preco = parseFloat(d.prod_preco) || parseFloat(d.valor) || 1;
    const valorDeb = parseFloat(d.valor) || 0;
    const qtdCalculada = preco > 0 ? (valorDeb / preco) : 1;

    if (!rawProducts[nome]) {
      rawProducts[nome] = {
        nome,
        grupo: d.prod_grupo || 'Geral',
        precoCadastro: preco,
        bipadas: 0,
        unidadesCalculadas: 0,
        faturamento: 0
      };
    }
    rawProducts[nome].bipadas += 1;
    rawProducts[nome].unidadesCalculadas += qtdCalculada;
    rawProducts[nome].faturamento += valorDeb;
  });

  console.log("\n=== TODOS OS PRODUTOS BRUTOS REGISTRADOS NO SISTEMA LA MORE ===");
  console.table(Object.values(rawProducts).map(p => ({
    Item: p.nome,
    Grupo: p.grupo,
    Preço: `R$ ${p.precoCadastro.toFixed(2)}`,
    Bipadas: p.bipadas,
    Unidades: p.unidadesCalculadas,
    Faturamento: `R$ ${p.faturamento.toFixed(2)}`
  })));

  await client.end();
}

runComprehensiveAudit().catch(console.error);
