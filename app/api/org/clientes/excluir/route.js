import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const allowedRoles = ['MASTER', 'ORGANIZADOR', 'ORG', 'SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'];

    if (!session || !role || !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    }

    const { cartaoId, codigo, eventoId } = await req.json();

    if (!cartaoId && !codigo) {
      return NextResponse.json({ error: 'cartaoId ou codigo é obrigatório.' }, { status: 400 });
    }

    // Localiza o cartão
    const cartao = await prisma.cartao.findFirst({
      where: {
        OR: [
          cartaoId ? { id: cartaoId } : undefined,
          codigo ? { codigo: codigo.toUpperCase().trim() } : undefined,
        ].filter(Boolean),
      },
      include: {
        cliente: true,
      },
    });

    if (!cartao) {
      return NextResponse.json({ error: 'Cartão não encontrado.' }, { status: 404 });
    }

    // Se não for Master, validar se o cartão pertence ao evento do usuário
    if (role !== 'MASTER') {
      if (session.user.eventoId && cartao.eventoId !== session.user.eventoId) {
        return NextResponse.json({ error: 'Acesso negado: Este cartão pertence a outro evento.' }, { status: 403 });
      }
    }

    const clienteId = cartao.clienteId;

    // Executa a exclusão definitiva em transação
    await prisma.$transaction(async (tx) => {
      // 1. Remove solicitações de devolução vinculadas
      await tx.solicitacaoDevolucao.deleteMany({
        where: { cartaoId: cartao.id }
      });

      // 2. Remove movimentações vinculadas
      await tx.movimentacao.deleteMany({
        where: { cartaoId: cartao.id }
      });

      // 3. Remove o cartão
      await tx.cartao.delete({
        where: { id: cartao.id }
      });

      // 4. Se o cliente não tem nenhum outro cartão em nenhum evento, remove o cadastro órfão
      if (clienteId) {
        const outrosCartoes = await tx.cartao.count({
          where: { clienteId }
        });
        if (outrosCartoes === 0) {
          await tx.cliente.delete({
            where: { id: clienteId }
          }).catch(() => {});
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Cartão ${cartao.codigo} (${cartao.cliente?.nome || 'Cliente'}) excluído definitivamente com sucesso.`
    });

  } catch (error) {
    console.error('Erro ao excluir cartão:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao excluir cartão.' }, { status: 500 });
  }
}
