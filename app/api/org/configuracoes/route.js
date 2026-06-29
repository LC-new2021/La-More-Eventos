import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventoIdQuery = searchParams.get('eventoId');

    const usuario = await prisma.usuario.findUnique({
      where: { id: session.user.id },
      include: { evento: true }
    });

    if (usuario.role !== 'ORGANIZADOR' && usuario.role !== 'MASTER') {
      return NextResponse.json({ error: 'Apenas Organizadores podem ver configurações financeiras' }, { status: 403 });
    }

    let targetEventoId = usuario.eventoId;

    if (usuario.role === 'MASTER') {
      if (!eventoIdQuery) {
        return NextResponse.json({ error: 'MASTER deve informar eventoId' }, { status: 400 });
      }
      targetEventoId = eventoIdQuery;
    }

    if (!targetEventoId) {
      return NextResponse.json({ error: 'Usuário sem evento vinculado' }, { status: 400 });
    }

    const eventoConfig = await prisma.evento.findUnique({
      where: { id: targetEventoId }
    });

    if (!eventoConfig) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    const eventoInfo = {
      gatewayActive: eventoConfig.gatewayActive,
      asaasToken: eventoConfig.asaasToken || '',
      asaasUrl: eventoConfig.asaasUrl,
      mercadoPagoPublicKey: eventoConfig.mercadoPagoPublicKey || '',
      mercadoPagoAccessToken: eventoConfig.mercadoPagoAccessToken || '',
      pagbankToken: eventoConfig.pagbankToken || '',
      stoneToken: eventoConfig.stoneToken || '',
      permitirEdicaoGateway: usuario.role === 'MASTER' ? true : (eventoConfig.permitirEdicaoGateway || false)
    };

    return NextResponse.json({ evento: eventoInfo });
  } catch (error) {
    console.error('Erro GET /api/org/configuracoes:', error);
    return NextResponse.json({ error: 'Falha ao carregar configurações' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const {
      gatewayActive,
      asaasToken,
      asaasUrl,
      mercadoPagoPublicKey,
      mercadoPagoAccessToken,
      pagbankToken,
      stoneToken,
      eventoId
    } = await req.json();

    const usuario = await prisma.usuario.findUnique({
      where: { id: session.user.id },
      include: { evento: true }
    });

    if (usuario.role !== 'ORGANIZADOR' && usuario.role !== 'MASTER') {
      return NextResponse.json({ error: 'Acesso negado. Apenas Organizadores podem alterar configurações financeiras.' }, { status: 403 });
    }

    let targetEventoId = usuario.eventoId;
    let targetEvento = usuario.evento;

    if (usuario.role === 'MASTER') {
      if (!eventoId) {
        return NextResponse.json({ error: 'MASTER deve informar o eventoId no body' }, { status: 400 });
      }
      targetEventoId = eventoId;
      targetEvento = await prisma.evento.findUnique({ where: { id: eventoId } });
    }

    if (!targetEventoId || !targetEvento) {
      return NextResponse.json({ error: 'Usuário sem evento vinculado ou evento não encontrado' }, { status: 400 });
    }

    if (usuario.role === 'ORGANIZADOR' && !targetEvento.permitirEdicaoGateway) {
      return NextResponse.json({ error: 'Acesso negado. A edição das credenciais de pagamento está desativada para o Produtor.' }, { status: 403 });
    }

    // Prepara dados de atualização
    const dataToUpdate = {
      gatewayActive
    };

    if (asaasToken) dataToUpdate.asaasToken = asaasToken.trim();
    if (asaasUrl) dataToUpdate.asaasUrl = asaasUrl.trim();
    if (mercadoPagoPublicKey) dataToUpdate.mercadoPagoPublicKey = mercadoPagoPublicKey.trim();
    if (mercadoPagoAccessToken) dataToUpdate.mercadoPagoAccessToken = mercadoPagoAccessToken.trim();
    if (pagbankToken) dataToUpdate.pagbankToken = pagbankToken.trim();
    if (stoneToken) dataToUpdate.stoneToken = stoneToken.trim();

    const eventoAtualizado = await prisma.evento.update({
      where: { id: targetEventoId },
      data: dataToUpdate
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro POST /api/org/configuracoes:', error);
    return NextResponse.json({ error: 'Falha ao salvar configurações' }, { status: 500 });
  }
}
