const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    // Buscar um usuário existente
    const user = await prisma.usuario.findFirst({ where: { email: 'novoemail@lamore.com' } });
    if (!user) return console.log('Usuário não encontrado');

    console.log('Testando update com o MESMO email para o user:', user.email);

    const updatedUser = await prisma.usuario.update({
      where: { id: user.id },
      data: { email: user.email, nome: 'Nome atualizado' }
    });

    console.log('Sucesso!', updatedUser.nome);
  } catch (e) {
    console.error('Erro no update:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
