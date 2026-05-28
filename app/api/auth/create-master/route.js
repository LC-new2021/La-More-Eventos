import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const hash = await bcrypt.hash('lamore2026', 10);
    const usuario = await prisma.usuario.upsert({
      where: { email: 'master@lamore.com' },
      update: {
        senha: hash,
        role: 'MASTER',
        ativo: true
      },
      create: {
        nome: 'Master La More',
        email: 'master@lamore.com',
        senha: hash,
        role: 'MASTER',
        ativo: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Usuário Master criado/atualizado com sucesso!',
      user: {
        id: usuario.id,
        email: usuario.email,
        role: usuario.role,
        ativo: usuario.ativo
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
