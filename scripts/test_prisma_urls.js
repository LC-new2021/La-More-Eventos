const { PrismaClient } = require('@prisma/client');

async function testUrl(dbUrl) {
  console.log(`\nTesting DATABASE_URL: ${dbUrl}`);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  });

  try {
    const eventos = await prisma.evento.findMany();
    const cartoes = await prisma.cartao.findMany({ include: { cliente: true } });
    const movs = await prisma.movimentacao.findMany({ include: { produto: true, cartao: true } });
    const produtos = await prisma.produto.findMany();
    const clientes = await prisma.cliente.findMany();
    const usuarios = await prisma.usuario.findMany();

    console.log(`Eventos: ${eventos.length}`);
    console.log(`Cartoes: ${cartoes.length}`);
    console.log(`Movimentacoes: ${movs.length}`);
    console.log(`Produtos: ${produtos.length}`);
    console.log(`Clientes: ${clientes.length}`);
    console.log(`Usuarios: ${usuarios.length}`);

    if (eventos.length > 0) {
      console.log('Eventos:', eventos.map(e => ({ id: e.id, nome: e.nome, status: e.status, data: e.data })));
    }
    if (cartoes.length > 0) {
      console.log('Cartões:', cartoes);
    }
    if (movs.length > 0) {
      console.log('Movimentações:', movs);
    }
  } catch (e) {
    console.error('Erro:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  await testUrl('file:./dev.db');
  await testUrl('file:../prisma/dev.db');
  await testUrl('file:../prisma/prisma/dev.db');
  await testUrl('file:C:/Users/Usuário/Desktop/BILHETERIA_LA/bilheteria-lamore/prisma/dev.db');
  await testUrl('file:C:/Users/Usuário/Desktop/BILHETERIA_LA/bilheteria-lamore/prisma/prisma/dev.db');
}

run();
