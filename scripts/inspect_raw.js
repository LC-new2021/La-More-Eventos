const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function rawInspect() {
  try {
    const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table';");
    console.log('Tabelas existentes no banco dev.db:', tables);

    for (const t of tables) {
      const name = t.name;
      if (name.startsWith('sqlite_') || name === '_prisma_migrations') continue;
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${name}"`);
      console.log(`Tabela ${name}:`, count);
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${name}" LIMIT 10`);
      console.log(`Dados em ${name}:`, rows);
    }
  } catch (e) {
    console.error('Erro:', e);
  } finally {
    await prisma.$disconnect();
  }
}

rawInspect();
