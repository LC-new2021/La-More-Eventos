const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const eventos = await prisma.evento.findMany();
  console.log('Eventos:', eventos.map(e => ({ id: e.id, nome: e.nome })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
