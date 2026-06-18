import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    // Prisma Transaction to delete test data but keep MASTER and Eventos/Produtos
    await prisma.$transaction([
      prisma.movimentacao.deleteMany(),
      prisma.solicitacaoDevolucao.deleteMany(),
      prisma.cartao.deleteMany(),
      prisma.cliente.deleteMany(),
      prisma.usuario.deleteMany({ where: { role: { not: 'MASTER' } } })
    ]);

    return NextResponse.json({ success: true, message: "Banco de produção limpo com sucesso!" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
