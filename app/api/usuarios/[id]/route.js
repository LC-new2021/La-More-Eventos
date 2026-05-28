import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
     const body = await req.json();
    const { nome, email, senha, role, ativo, eventoId, razaoSocial, cnpj, ie, endereco, telefone, gatewayActive, asaasToken, asaasUrl, pagbankToken, pagbankKey } = body;

    // Fetch the target user to verify they belong to the same event
    const targetUser = await prisma.usuario.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    if (session.user.role === 'ORGANIZADOR') {
      if (targetUser.eventoId !== session.user.eventoId) {
        return NextResponse.json({ error: 'Acesso negado a este usuário' }, { status: 403 });
      }
      if (role && !['CAIXA', 'OPERADOR_BAR'].includes(role)) {
        return NextResponse.json({ error: 'Função não permitida' }, { status: 403 });
      }
      if (eventoId && eventoId !== session.user.eventoId) {
        return NextResponse.json({ error: 'Não autorizado a alterar o evento' }, { status: 403 });
      }
    } else if (session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const updateData = {};
    if (nome) updateData.nome = nome;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (ativo !== undefined) updateData.ativo = ativo;
    if (eventoId !== undefined) updateData.eventoId = eventoId;
    if (senha) updateData.senha = await bcrypt.hash(senha, 10);
    if (razaoSocial !== undefined) updateData.razaoSocial = razaoSocial;
    if (cnpj !== undefined) updateData.cnpj = cnpj;
    if (ie !== undefined) updateData.ie = ie;
    if (endereco !== undefined) updateData.endereco = endereco;
    if (telefone !== undefined) updateData.telefone = telefone;
    if (gatewayActive !== undefined) updateData.gatewayActive = gatewayActive;
    if (asaasToken !== undefined) updateData.asaasToken = asaasToken;
    if (asaasUrl !== undefined) updateData.asaasUrl = asaasUrl;
    if (pagbankToken !== undefined) updateData.pagbankToken = pagbankToken;
    if (pagbankKey !== undefined) updateData.pagbankKey = pagbankKey;

    const usuario = await prisma.usuario.update({
      where: { id },
      data: updateData,
    });

    const { senha: _, ...safeUsuario } = usuario;
    return NextResponse.json(safeUsuario);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const targetUser = await prisma.usuario.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    if (session.user.role === 'ORGANIZADOR') {
      if (targetUser.eventoId !== session.user.eventoId) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
    } else if (session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    
    const usuario = await prisma.usuario.update({
      where: { id },
      data: { ativo: false },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
