const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.usuario.findMany({ select: { email: true, role: true, ativo: true } });
  console.log('Users:');
  console.table(users);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
