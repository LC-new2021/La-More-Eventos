const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:VWuLyODchlYWoIlzMuePOphoNvoiBUDp@kodama.proxy.rlwy.net:47379/railway' });

// Gerador de CPF válido para testes
function gerarCpfValido() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  let d1 = n.reduce((total, number, index) => total + number * (10 - index), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  n.push(d1);
  let d2 = n.reduce((total, number, index) => total + number * (11 - index), 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  n.push(d2);
  return n.join('');
}

async function run() {
  await client.connect();
  const resEvento = await client.query('SELECT id, nome, "gatewayActive", "chavePix", "titularPix", "asaasToken", "mercadoPagoAccessToken" FROM "Evento";');
  for (const e of resEvento.rows) {
    console.log(`Evento: ${e.nome} (${e.id})`);
    console.log(`  gatewayActive: ${e.gatewayActive}`);
    console.log(`  chavePix: ${e.chavePix} | titular: ${e.titularPix}`);
    console.log(`  asaasToken: ${e.asaasToken ? e.asaasToken.substring(0, 15) + '...' : 'NONE'}`);
    console.log(`  mpAccessToken: ${e.mercadoPagoAccessToken ? e.mercadoPagoAccessToken.substring(0, 15) + '...' : 'NONE'}`);
  }
  await client.end();
}

run().catch(console.error);

