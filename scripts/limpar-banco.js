const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('Iniciando limpeza cirúrgica do banco de dados...');

  try {
    // 1. Apagar todas as movimentações
    const resMov = await prisma.movimentacao.deleteMany();
    console.log(`- Movimentações deletadas: ${resMov.count}`);

    // 2. Apagar solicitações de devolução
    const resDev = await prisma.solicitacaoDevolucao.deleteMany();
    console.log(`- Solicitações de Devolução deletadas: ${resDev.count}`);

    // 3. Apagar todos os cartões
    const resCartoes = await prisma.cartao.deleteMany();
    console.log(`- Cartões deletados: ${resCartoes.count}`);

    // 4. Apagar todos os clientes
    const resClientes = await prisma.cliente.deleteMany();
    console.log(`- Clientes deletados: ${resClientes.count}`);

    // 5. Apagar todos os usuários que NÃO SÃO MASTER
    const resUsuarios = await prisma.usuario.deleteMany({
      where: {
        role: {
          not: 'MASTER'
        }
      }
    });
    console.log(`- Usuários de teste deletados: ${resUsuarios.count}`);

    console.log('\n✅ Banco de dados limpo com sucesso! Apenas Eventos, Produtos e o Master foram mantidos.');
  } catch (e) {
    console.error('Erro ao limpar o banco:', e);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
