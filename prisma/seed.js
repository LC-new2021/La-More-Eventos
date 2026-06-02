// prisma/seed.js — Prisma 5
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Criando banco de dados...\n');

  const hash = (senha) => bcrypt.hash(senha, 10);

  const master = await prisma.usuario.upsert({
    where: { email: 'master@lamore.com' },
    update: { role: 'MASTER', ativo: true },
    create: { nome: 'Master La More', email: 'master@lamore.com', senha: await hash('lamore2026'), role: 'MASTER', ativo: true },
  });

  const evento = await prisma.evento.upsert({
    where: { id: 'evento-demo-001' },
    update: {},
    create: { id: 'evento-demo-001', nome: 'La More Summer Party', data: new Date('2026-06-15T20:00:00'), local: 'La More Fashion — Salão Principal', status: 'CONFIGURANDO', taxaMasterPercent: 5.0 },
  });

  await prisma.usuario.upsert({ where: { email: 'org@lamore.com' }, update: { role: 'ORGANIZADOR', ativo: true, eventoId: evento.id }, create: { nome: 'Organizador', email: 'org@lamore.com', senha: await hash('org2026'), role: 'ORGANIZADOR', ativo: true, eventoId: evento.id } });
  await prisma.usuario.upsert({ where: { email: 'caixa@lamore.com' }, update: { role: 'CAIXA', ativo: true, eventoId: evento.id }, create: { nome: 'Caixa Entrada', email: 'caixa@lamore.com', senha: await hash('caixa2026'), role: 'CAIXA', ativo: true, eventoId: evento.id } });
  await prisma.usuario.upsert({ where: { email: 'bar@lamore.com' }, update: { role: 'OPERADOR_BAR', ativo: true, eventoId: evento.id }, create: { nome: 'Operador Bar', email: 'bar@lamore.com', senha: await hash('bar2026'), role: 'OPERADOR_BAR', ativo: true, eventoId: evento.id } });

  const produtos = [
    { id: 'prod-01', nome: 'Heineken 600ml', preco: 18, grupo: 'Bebidas' },
    { id: 'prod-02', nome: 'Skol Beats 269ml', preco: 12, grupo: 'Bebidas' },
    { id: 'prod-03', nome: 'Água Mineral', preco: 5, grupo: 'Bebidas' },
    { id: 'prod-04', nome: 'Refrigerante Lata', preco: 7, grupo: 'Bebidas' },
    { id: 'prod-05', nome: 'Hambúrguer Artesanal', preco: 32, grupo: 'Food' },
    { id: 'prod-06', nome: 'Batata Frita', preco: 22, grupo: 'Food' },
    { id: 'prod-07', nome: 'Porção de Frango', preco: 28, grupo: 'Food' },
  ];
  for (const p of produtos) {
    await prisma.produto.upsert({ where: { id: p.id }, update: {}, create: { ...p, ativo: true, eventoId: evento.id } });
  }

  console.log('✅ Banco populado!\n');
  console.log('🔑 CREDENCIAIS:');
  console.log('  👑 master@lamore.com  / lamore2026');
  console.log('  🎯 org@lamore.com     / org2026');
  console.log('  💳 caixa@lamore.com   / caixa2026');
  console.log('  🍺 bar@lamore.com     / bar2026\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
