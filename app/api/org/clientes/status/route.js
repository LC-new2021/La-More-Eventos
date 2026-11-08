import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logSupportAction } from '@/lib/audit';

export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const allowedRoles = ['MASTER', 'ORGANIZADOR', 'ORG', 'SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'];

    if (!session || !role || !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { eventoId, cartaoId, status } = await req.json();

    if (!eventoId || !status) {
      return NextResponse.json({ error: 'eventoId e status são obrigatórios' }, { status: 400 });
    }

    // Regra: Suporte Operacional NÃO pode excluir/cancelar cliente
    if (status === 'CANCELADO' && ['SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role)) {
      return NextResponse.json({ error: 'Suporte Operacional não possui permissão para excluir/cancelar clientes.' }, { status: 403 });
    }

    // Segurança: se não for MASTER, verificar se ele tem acesso a esse evento
    if (role !== 'MASTER') {
      if (session.user.eventoId && session.user.eventoId !== eventoId) {
        return NextResponse.json({ error: 'Acesso negado a este evento' }, { status: 403 });
      }
    }

    if (cartaoId) {
      // Atualiza apenas um cartão
      const updated = await prisma.cartao.updateMany({
        where: { id: cartaoId, eventoId },
        data: { status }
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: 'Cartão não encontrado neste evento' }, { status: 404 });
      }

      if (['SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role)) {
        await logSupportAction({
          session,
          eventoId,
          acao: `STATUS_CLIENTE_${status}`,
          detalhes: `Alteração de status do cliente para ${status} (cartão: ${cartaoId})`,
        });
      }

      return NextResponse.json({ success: true, message: 'Cartão atualizado' });
    } else {
      // Atualiza todos os cartões do evento
      const updated = await prisma.cartao.updateMany({
        where: { eventoId },
        data: { status }
      });

      if (['SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role)) {
        await logSupportAction({
          session,
          eventoId,
          acao: `STATUS_CLIENTE_${status}_TODOS`,
          detalhes: `Alteração em lote de ${updated.count} cartões para ${status}`,
        });
      }

      return NextResponse.json({ success: true, message: `${updated.count} cartões atualizados` });
    }
  } catch (error) {
    console.error('Erro ao atualizar status dos cartões:', error);
    return NextResponse.json({ error: 'Erro interno ao processar solicitação' }, { status: 500 });
  }
}
