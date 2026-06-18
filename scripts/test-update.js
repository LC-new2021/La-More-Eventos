const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function test() {
  try {
    // 1. Criar um usuário de teste
    const hashedPassword = await bcrypt.hash('123456', 10);
    const user = await prisma.usuario.create({
      data: {
        nome: 'Test Master',
        email: 'testmaster@lamore.com',
        senha: hashedPassword,
        role: 'MASTER'
      }
    });

    console.log('Usuário criado com sucesso:', user.id);

    // 2. Simular o que a API faz ao dar PATCH
    const body = {
      nome: 'Test Master Alterado',
      email: 'novoemail@lamore.com',
      senha: 'nova_senha_secreta',
      role: 'MASTER'
    };

    const updateData = {};
    if (body.nome) updateData.nome = body.nome;
    if (body.email) updateData.email = body.email;
    if (body.role) updateData.role = body.role;
    if (body.ativo !== undefined) updateData.ativo = body.ativo;
    if (body.eventoId !== undefined) updateData.eventoId = body.eventoId;
    if (body.senha) updateData.senha = await bcrypt.hash(body.senha, 10);

    const updatedUser = await prisma.usuario.update({
      where: { id: user.id },
      data: updateData
    });

    console.log('Usuário atualizado com sucesso:', updatedUser);
  } catch (e) {
    console.error('Erro:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
