const { Client } = require('pg');
const connectionString = "postgresql://postgres:VWuLyODchlYWoIlzMuePOphoNvoiBUDp@kodama.proxy.rlwy.net:47379/railway";

async function deepAudit() {
  const client = new Client({ connectionString });
  await client.connect();

  const evRes = await client.query(`SELECT * FROM "Evento"`);
  console.log("LISTA DE TODOS OS EVENTOS NO BANCO:", evRes.rows.map(e => ({ id: e.id, nome: e.nome })));

  for (const ev of evRes.rows) {
    const totalRec = await client.query(`
      SELECT SUM(m.valor) as total, COUNT(*) as qtd
      FROM "Movimentacao" m
      JOIN "Cartao" c ON m."cartaoId" = c.id
      WHERE c."eventoId" = $1 AND m.tipo = 'RECARGA'
    `, [ev.id]);

    const totalDeb = await client.query(`
      SELECT SUM(m.valor) as total, COUNT(*) as qtd
      FROM "Movimentacao" m
      JOIN "Cartao" c ON m."cartaoId" = c.id
      WHERE c."eventoId" = $1 AND m.tipo = 'DEBITO'
    `, [ev.id]);

    const totalEst = await client.query(`
      SELECT SUM(m.valor) as total, COUNT(*) as qtd
      FROM "Movimentacao" m
      JOIN "Cartao" c ON m."cartaoId" = c.id
      WHERE c."eventoId" = $1 AND m.tipo = 'ESTORNO'
    `, [ev.id]);

    const totalSaldo = await client.query(`
      SELECT SUM(saldo) as total, COUNT(*) as qtd
      FROM "Cartao"
      WHERE "eventoId" = $1
    `, [ev.id]);

    console.log(`\n========================================`);
    console.log(`EVENTO: ${ev.nome} (${ev.id})`);
    console.log(`Total Recargas: R$ ${totalRec.rows[0].total} (${totalRec.rows[0].qtd} transações)`);
    console.log(`Total Consumo Bar: R$ ${totalDeb.rows[0].total} (${totalDeb.rows[0].qtd} itens)`);
    console.log(`Total Estornos: R$ ${totalEst.rows[0].total || 0} (${totalEst.rows[0].qtd} estornos)`);
    console.log(`Saldo em Cartões: R$ ${totalSaldo.rows[0].total} (${totalSaldo.rows[0].qtd} cartões)`);
  }

  await client.end();
}

deepAudit();
