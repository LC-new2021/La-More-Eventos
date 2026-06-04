// prisma/build.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.join(__dirname, 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Se a string de conexão começar com postgres ou prisma+postgres, altera o provider do schema para postgresql
if (process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('postgresql') || process.env.DATABASE_URL.includes('postgres') || process.env.DATABASE_URL.includes('prisma+postgres'))) {
  console.log('--- BUILD PROCESSO ---');
  console.log('Banco PostgreSQL detectado. Ajustando provider do Prisma...');
  schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
  fs.writeFileSync(schemaPath, schema);
  console.log('Provider atualizado para postgresql no schema.prisma!');
} else {
  console.log('--- BUILD PROCESSO ---');
  console.log('Banco SQLite detectado ou nenhuma DATABASE_URL de produção. Ajustando provider...');
  schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
  fs.writeFileSync(schemaPath, schema);
  console.log('Provider atualizado para sqlite no schema.prisma!');
}
