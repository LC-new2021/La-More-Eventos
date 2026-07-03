const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.usuario.findUnique({where: {email: 'caixa@lamore.com.br'}});
  console.log('User Role:', u?.role);
  console.log('User Ativo:', u?.ativo);
  console.log('User EventoId:', u?.eventoId);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
