import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    let eventoId = searchParams.get('eventoId');

    // Enforce scoping for ORGANIZADOR
    if (session.user.role === 'ORGANIZADOR') {
      eventoId = session.user.eventoId;
    } else if (session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const usuarios = await prisma.usuario.findMany({
      where: {
        ...(role && { role }),
        ...(eventoId && { eventoId }),
      },
      include: {
        evento: { select: { nome: true } }
      },
      orderBy: { criadoEm: 'desc' },
    });

    const safeUsuarios = usuarios.map(u => {
      const { senha, ...rest } = u;
      return rest;
    });

    return NextResponse.json(safeUsuarios);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    let { nome, email, senha, role, eventoId, razaoSocial, cnpj, ie, endereco, telefone, gatewayActive, asaasToken, asaasUrl, pagbankToken, pagbankKey, stoneToken } = body;

    if (!nome || !email || !senha || !role) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Enforce scoping for ORGANIZADOR
    if (session.user.role === 'ORGANIZADOR') {
      eventoId = session.user.eventoId;
      // Organizers can only create POS/Caixa and Bar operators
      if (!['CAIXA', 'OPERADOR_BAR', 'TESOURARIA'].includes(role)) {
        return NextResponse.json({ error: 'Função não permitida para organizadores' }, { status: 403 });
      }
    } else if (session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const existing = await prisma.usuario.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
        role,
        ativo: true,
        ...(eventoId && { eventoId }),
        razaoSocial,
        cnpj,
        ie,
        endereco,
        telefone,
        gatewayActive,
        asaasToken,
        asaasUrl,
        pagbankToken,
        pagbankKey,
        stoneToken,
      },
    });

    const { senha: _, ...safeUsuario } = usuario;
    return NextResponse.json(safeUsuario, { status: 201 });
  } catch (e) {
    if (e.code === 'P2002' && e.meta?.target?.includes('email')) {
      return NextResponse.json({ error: 'Este e-mail já está em uso por outro usuário.' }, { status: 400 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
