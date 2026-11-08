const { Client } = require('pg');
const connectionString = "postgresql://postgres:VWuLyODchlYWoIlzMuePOphoNvoiBUDp@kodama.proxy.rlwy.net:47379/railway";

async function detailedFullAudit() {
  const client = new Client({ connectionString });
  await client.connect();

  const evRes = await client.query(`SELECT * FROM "Evento"`);
  console.log("EVENTOS:", evRes.rows);

  const ev = evRes.rows[0];

  // 1. Total de cartões
  const cartoes = await client.query(`
    SELECT c.*, cl.nome as cliente_nome, cl.cpf, cl.celular
    FROM "Cartao" c
    LEFT JOIN "Cliente" cl ON c."clienteId" = cl.id
  `);

  // 2. Total de movimentações
  const movs = await client.query(`
    SELECT m.*, p.nome as prod_nome, p.preco as prod_preco, p.grupo as prod_grupo
    FROM "Movimentacao" m
    LEFT JOIN "Produto" p ON m."produtoId" = p.id
    ORDER BY m."criadaEm" ASC
  `);

  console.log(`\n==============================================`);
  console.log(`TOTAL DE CARTÕES: ${cartoes.rows.length}`);
  console.log(`TOTAL DE MOVIMENTAÇÕES: ${movs.rows.length}`);
  console.log(`==============================================`);

  // Estatísticas de Recargas
  const recargas = movs.rows.filter(m => m.tipo === 'RECARGA');
  const debitos = movs.rows.filter(m => m.tipo === 'DEBITO');
  const estornos = movs.rows.filter(m => m.tipo === 'ESTORNO');

  let totalRecargas = recargas.reduce((acc, r) => acc + parseFloat(r.valor), 0);
  let totalDebitos = debitos.reduce((acc, d) => acc + parseFloat(d.valor), 0);
  let totalEstornos = estornos.reduce((acc, e) => acc + parseFloat(e.valor), 0);
  let totalSaldoCartoes = cartoes.rows.reduce((acc, c) => acc + parseFloat(c.saldo), 0);

  console.log(`TOTAL RECARREGADO: R$ ${totalRecargas.toFixed(2)} (${recargas.length} recargas)`);
  console.log(`TOTAL DEBITADO (VENDAS NO BAR): R$ ${totalDebitos.toFixed(2)} (${debitos.length} itens consumidos)`);
  console.log(`TOTAL ESTORNADO: R$ ${totalEstornos.toFixed(2)} (${estornos.length} estornos)`);
  console.log(`TOTAL SALDO RESTANTE: R$ ${totalSaldoCartoes.toFixed(2)}`);

  console.log(`CONCILIAÇÃO: ${totalRecargas.toFixed(2)} - ${totalDebitos.toFixed(2)} - ${totalEstornos.toFixed(2)} = ${(totalRecargas - totalDebitos - totalEstornos).toFixed(2)}`);
  console.log(`DIFERENÇA COM SALDO DOS CARTÕES: ${(totalRecargas - totalDebitos - totalEstornos - totalSaldoCartoes).toFixed(4)}`);

  // Produtos vendidos tabela completa
  const prodMap = {};
  debitos.forEach(d => {
    const nome = d.prod_nome || d.descricao || 'Sem Nome';
    if (!prodMap[nome]) {
      prodMap[nome] = {
        grupo: d.prod_grupo || 'Geral',
        preco: parseFloat(d.prod_preco) || parseFloat(d.valor),
        qtd: 0,
        total: 0
      };
    }
    prodMap[nome].qtd++;
    prodMap[nome].total += parseFloat(d.valor);
  });

  console.log(`\n=== TABELA COMPLETA DE PRODUTOS VENDIDOS NO SISTEMA ===`);
  const listaProd = Object.keys(prodMap).map(k => ({
    Produto: k,
    Grupo: prodMap[k].grupo,
    Preco: prodMap[k].preco,
    Qtd: prodMap[k].qtd,
    Total: prodMap[k].total
  })).sort((a,b) => b.Qtd - a.Qtd);

  console.table(listaProd);

  // Cartões com saldo que não gastaram
  console.log(`\n=== CARTÕES COM SALDO RESTANTE > R$ 0 ===`);
  const comSaldo = cartoes.rows.filter(c => parseFloat(c.saldo) > 0).map(c => ({
    Codigo: c.codigo,
    Cliente: c.cliente_nome,
    CPF: c.cpf,
    Saldo: parseFloat(c.saldo)
  })).sort((a,b) => b.Saldo - a.Saldo);

  console.table(comSaldo.slice(0, 30));
  console.log(`Total de cartões com sobra de saldo: ${comSaldo.length}`);
  console.log(`Soma dos saldos esquecidos/retidos: R$ ${comSaldo.reduce((acc, c) => acc + c.Saldo, 0).toFixed(2)}`);

  await client.end();
}

detailedFullAudit();
