// prisma/build.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.join(__dirname, 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Se a string de conexão começar com postgres, altera o provider do schema para postgresql
if (process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith('postgresql') || process.env.DATABASE_URL.startsWith('postgres'))) {
  console.log('--- BUILD PROCESSO ---');
  console.log('Banco de Produção detectado. Ajustando provider do Prisma para PostgreSQL...');
  schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
  fs.writeFileSync(schemaPath, schema);
  console.log('Provider atualizado com sucesso no schema.prisma!');

  // Rodar push das tabelas para o Postgres
  console.log('Sincronizando tabelas com o PostgreSQL...');
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });

  // Criar o usuário Master inicial via script integrado para evitar problemas com seed ES Modules
  console.log('Populando dados iniciais no PostgreSQL...');
  try {
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const prisma = new PrismaClient();

    async function runSeed() {
      const hash = await bcrypt.hash('lamore2026', 10);
      await prisma.usuario.upsert({
        where: { email: 'master@lamore.com' },
        update: {},
        create: {
          nome: 'Master La More',
          email: 'master@lamore.com',
          senha: hash,
          role: 'MASTER',
          ativo: true,
        },
      });
      console.log('✅ Usuário Master cadastrado com sucesso!');
    }

    runSeed()
      .catch((err) => console.error('Erro no seed integrado:', err))
      .finally(() => prisma.$disconnect());
  } catch (e) {
    console.error('Falha ao rodar seed integrado:', e.message);
  }
} else {
  console.log('--- BUILD PROCESSO ---');
  console.log('Banco local (SQLite) ou nenhuma DATABASE_URL de produção configurada.');
}

