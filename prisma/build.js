// prisma/build.js
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Se a string de conexão começar com postgres, altera o provider do schema para postgresql
if (process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith('postgresql') || process.env.DATABASE_URL.startsWith('postgres'))) {
  console.log('--- BUILD PROCESSO ---');
  console.log('Banco de Produção detectado. Ajustando provider do Prisma para PostgreSQL...');
  schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
  fs.writeFileSync(schemaPath, schema);
  console.log('Provider atualizado com sucesso no schema.prisma!');
} else {
  console.log('--- BUILD PROCESSO ---');
  console.log('Banco local (SQLite) ou nenhuma DATABASE_URL de produção configurada.');
}
