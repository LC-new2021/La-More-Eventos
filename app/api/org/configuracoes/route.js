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

    const usuario = await prisma.usuario.findUnique({
      where: { id: session.user.id },
      include: { evento: true }
    });

    if (!usuario || !usuario.eventoId) {
      return NextResponse.json({ error: 'Usuário sem evento vinculado' }, { status: 400 });
    }

    // Apenas quem for ORGANIZADOR ou MASTER deve ver isso (ou todos podem ver a configuração do evento que operam? Idealmente Organizador/Master)
    if (usuario.role !== 'ORGANIZADOR' && usuario.role !== 'MASTER') {
      return NextResponse.json({ error: 'Apenas Organizadores podem ver configurações financeiras' }, { status: 403 });
    }

    // Retorna as configurações, mascarando parcialmente os tokens por segurança
    const eventoInfo = {
      gatewayActive: usuario.evento.gatewayActive,
      asaasToken: usuario.evento.asaasToken ? maskToken(usuario.evento.asaasToken) : '',
      asaasUrl: usuario.evento.asaasUrl,
      mercadoPagoPublicKey: usuario.evento.mercadoPagoPublicKey || '',
      mercadoPagoAccessToken: usuario.evento.mercadoPagoAccessToken ? maskToken(usuario.evento.mercadoPagoAccessToken) : '',
      pagbankToken: usuario.evento.pagbankToken ? maskToken(usuario.evento.pagbankToken) : '',
      stonePublicKey: usuario.evento.stonePublicKey || '',
      stoneSecretKey: usuario.evento.stoneSecretKey ? maskToken(usuario.evento.stoneSecretKey) : '',
      permiteDevolucao: usuario.evento.permiteDevolucao || false
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
      stonePublicKey,
      stoneSecretKey,
      permiteDevolucao
    } = await req.json();

    const usuario = await prisma.usuario.findUnique({
      where: { id: session.user.id }
    });

    if (!usuario || !usuario.eventoId) {
      return NextResponse.json({ error: 'Usuário sem evento vinculado' }, { status: 400 });
    }

    if (usuario.role !== 'ORGANIZADOR' && usuario.role !== 'MASTER') {
      return NextResponse.json({ error: 'Acesso negado. Apenas Organizadores podem alterar configurações financeiras.' }, { status: 403 });
    }

    // Prepara dados de atualização
    const dataToUpdate = {
      gatewayActive,
      permiteDevolucao: !!permiteDevolucao
    };

    // Só atualiza os tokens se eles não estiverem mascarados (ou seja, se o usuário digitou um novo valor)
    if (asaasToken && !asaasToken.includes('***')) {
      dataToUpdate.asaasToken = asaasToken.trim();
    }
    
    if (asaasUrl) {
      dataToUpdate.asaasUrl = asaasUrl.trim();
    }

    if (mercadoPagoPublicKey) {
      dataToUpdate.mercadoPagoPublicKey = mercadoPagoPublicKey.trim();
    }

    if (mercadoPagoAccessToken && !mercadoPagoAccessToken.includes('***')) {
      dataToUpdate.mercadoPagoAccessToken = mercadoPagoAccessToken.trim();
    }

    if (pagbankToken && !pagbankToken.includes('***')) {
      dataToUpdate.pagbankToken = pagbankToken.trim();
    }

    if (stonePublicKey) {
      dataToUpdate.stonePublicKey = stonePublicKey.trim();
    }

    if (stoneSecretKey && !stoneSecretKey.includes('***')) {
      dataToUpdate.stoneSecretKey = stoneSecretKey.trim();
    }

    const eventoAtualizado = await prisma.evento.update({
      where: { id: usuario.eventoId },
      data: dataToUpdate
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro POST /api/org/configuracoes:', error);
    return NextResponse.json({ error: 'Falha ao salvar configurações' }, { status: 500 });
  }
}

function maskToken(token) {
  if (!token) return '';
  if (token.length <= 8) return '***';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}
