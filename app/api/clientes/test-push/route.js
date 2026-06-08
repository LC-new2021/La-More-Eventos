import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { enviarNotificacao } from '@/lib/push';

export async function POST(req) {
  try {
    const { clienteId, usuarioId } = await req.json();

    let pushSubscriptionJson = null;
    let targetName = 'Usuário';
    let targetUrl = '/';

    if (clienteId) {
      const cliente = await prisma.cliente.findUnique({
        where: { id: clienteId },
        include: { cartoes: { take: 1 } }
      });
      if (!cliente) {
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
      }
      pushSubscriptionJson = cliente.pushSubscriptionJson;
      targetName = cliente.nome;
      const cardCode = cliente.cartoes?.[0]?.codigo;
      targetUrl = cardCode ? `/cartao/${cardCode.toUpperCase()}` : '/';
    } else if (usuarioId) {
      const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
      if (!usuario) {
        return NextResponse.json({ error: 'Operador não encontrado' }, { status: 404 });
      }
      pushSubscriptionJson = usuario.pushSubscriptionJson;
      targetName = usuario.nome;
      targetUrl = '/pos';
    } else {
      return NextResponse.json({ error: 'Parâmetro clienteId ou usuarioId é obrigatório' }, { status: 400 });
    }

    if (!pushSubscriptionJson) {
      return NextResponse.json({ error: 'Inscrição de notificações não ativa no dispositivo.' }, { status: 400 });
    }

    await enviarNotificacao(
      pushSubscriptionJson,
      'Teste de Notificação 🔔',
      `Olá ${targetName}! Suas notificações do La More Eventos estão funcionando corretamente.`,
      targetUrl
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
