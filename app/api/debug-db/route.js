import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado. Apenas administradores Master podem acessar.' }, { status: 403 });
    }

    const users = await prisma.usuario.findMany({
      include: {
        evento: { select: { id: true, nome: true } }
      }
    });

    const events = await prisma.evento.findMany({
      select: { id: true, nome: true }
    });

    return NextResponse.json({
      session,
      users: users.map(u => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        role: u.role,
        eventoId: u.eventoId,
        eventoNome: u.evento?.nome,
        ativo: u.ativo
      })),
      events
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
