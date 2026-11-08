const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPaths = [
  path.join(__dirname, '../prisma/dev.db'),
  path.join(__dirname, '../prisma/prisma/dev.db')
];

async function checkDb(dbFile) {
  console.log(`\n======================================================`);
  console.log(`VERIFICANDO BANCO DE DADOS: ${dbFile}`);
  console.log(`======================================================`);

  const db = new sqlite3.Database(dbFile);

  const query = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  try {
    const tables = await query("SELECT name FROM sqlite_master WHERE type='table';");
    console.log('Tabelas:', tables.map(t => t.name));

    for (const t of tables) {
      if (t.name.startsWith('sqlite_') || t.name === '_prisma_migrations') continue;
      const count = await query(`SELECT COUNT(*) as total FROM "${t.name}"`);
      console.log(`- Tabela ${t.name}: ${count[0].total} registros`);
      
      if (count[0].total > 0) {
        const sample = await query(`SELECT * FROM "${t.name}" LIMIT 5`);
        console.log(`  Exemplo de dados em ${t.name}:`, sample);
      }
    }
  } catch (e) {
    console.error('Erro ao ler banco:', e.message);
  } finally {
    db.close();
  }
}

async function run() {
  for (const p of dbPaths) {
    await checkDb(p);
  }
}

run();
