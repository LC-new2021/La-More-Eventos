import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const evento = await prisma.evento.findUnique({
      where: { id }
    });
    if (!evento) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });

    // Se o usuário logado for MASTER ou ORGANIZADOR, envia os tokens confidenciais
    const isAuthorized = session && ['MASTER', 'ORGANIZADOR'].includes(session.user.role);

    const safeResponse = {
      ...evento,
      gatewayActive: evento.gatewayActive || "NENHUM"
    };

    if (!isAuthorized) {
      delete safeResponse.asaasToken;
      delete safeResponse.asaasUrl;
      delete safeResponse.pagbankToken;
      delete safeResponse.pagbankKey;
      delete safeResponse.stoneToken;
      delete safeResponse.mercadoPagoAccessToken;
      delete safeResponse.mercadoPagoRefreshToken;
    }

    return NextResponse.json(safeResponse);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['MASTER', 'ORGANIZADOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // Se for organizador, verificar se este é o evento dele
    if (session.user.role === 'ORGANIZADOR' && session.user.eventoId !== id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const updateData = {};
    if (body.nome) updateData.nome = body.nome;
    if (body.status) updateData.status = body.status;
    if (body.local) updateData.local = body.local;
    if (body.data) updateData.data = new Date(body.data);
    if (body.taxaMasterPercent !== undefined) {
      updateData.taxaMasterPercent = parseFloat(body.taxaMasterPercent);
    }
    if (body.metodosPagamentoJson !== undefined) {
      updateData.metodosPagamentoJson = body.metodosPagamentoJson;
    }
    if (body.bilheteriaEventoId !== undefined) {
      updateData.bilheteriaEventoId = body.bilheteriaEventoId || null;
    }
    
    // Configurações do Gateway
    if (body.gatewayActive !== undefined) updateData.gatewayActive = body.gatewayActive;
    if (body.asaasToken !== undefined) updateData.asaasToken = body.asaasToken;
    if (body.asaasUrl !== undefined) updateData.asaasUrl = body.asaasUrl;
    if (body.pagbankToken !== undefined) updateData.pagbankToken = body.pagbankToken;
    if (body.stoneToken !== undefined) updateData.stoneToken = body.stoneToken;
    if (body.mercadoPagoPublicKey !== undefined) updateData.mercadoPagoPublicKey = body.mercadoPagoPublicKey;
    if (body.mercadoPagoAccessToken !== undefined) updateData.mercadoPagoAccessToken = body.mercadoPagoAccessToken;
    if (body.mercadoPagoRefreshToken !== undefined) updateData.mercadoPagoRefreshToken = body.mercadoPagoRefreshToken;
    if (body.mercadoPagoUserId !== undefined) updateData.mercadoPagoUserId = body.mercadoPagoUserId;
    if (body.permiteDevolucao !== undefined) updateData.permiteDevolucao = body.permiteDevolucao;
    if (body.permitirEdicaoGateway !== undefined) updateData.permitirEdicaoGateway = body.permitirEdicaoGateway;
    if (body.modoOperacao !== undefined) updateData.modoOperacao = body.modoOperacao;

    const evento = await prisma.evento.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(evento);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { id } = await params;

    // Prisma Transaction to delete everything linked to the event
    await prisma.$transaction([
      prisma.movimentacao.deleteMany({ where: { cartao: { eventoId: id } } }),
      prisma.solicitacaoDevolucao.deleteMany({ where: { eventoId: id } }),
      prisma.cartao.deleteMany({ where: { eventoId: id } }),
      prisma.produto.deleteMany({ where: { eventoId: id } }),
      prisma.usuario.updateMany({ where: { eventoId: id }, data: { eventoId: null, ativo: false } }),
      prisma.evento.delete({ where: { id } })
    ]);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
