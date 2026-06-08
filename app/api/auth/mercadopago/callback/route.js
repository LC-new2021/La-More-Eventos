import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Contém o eventoId

  // Se houver erro retornado pelo Mercado Pago
  const error = searchParams.get('error');
  if (error || !code || !state) {
    console.error('[Mercado Pago Connect] Erro ou parâmetros ausentes:', error);
    return NextResponse.redirect(new URL('/master/eventos?error=mercadopago_auth_failed', req.url));
  }

  try {
    const clientId = process.env.NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID;
    const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;
    const redirectUri = process.env.NEXT_PUBLIC_MERCADOPAGO_REDIRECT_URI;

    console.log('[Mercado Pago Connect] Trocando code por tokens para o evento:', state);

    // Trocar o code por access_token e public_key
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await response.json();

    if (!response.ok || !tokenData.access_token) {
      console.error('[Mercado Pago Connect] Erro no intercâmbio de tokens:', tokenData);
      return NextResponse.redirect(new URL('/master/eventos?error=token_exchange_failed', req.url));
    }

    // Salvar as credenciais no banco de dados vinculadas ao evento (state)
    await prisma.evento.update({
      where: { id: state },
      data: {
        mercadoPagoAccessToken: tokenData.access_token,
        mercadoPagoPublicKey: tokenData.public_key,
        mercadoPagoRefreshToken: tokenData.refresh_token,
        mercadoPagoUserId: tokenData.user_id ? tokenData.user_id.toString() : null
      }
    });

    console.log('[Mercado Pago Connect] Conta vinculada com sucesso no evento:', state);
    return NextResponse.redirect(new URL('/master/eventos?success=mercadopago_connected', req.url));

  } catch (e) {
    console.error('[Mercado Pago Connect] Erro crítico na rota de callback:', e);
    return NextResponse.redirect(new URL('/master/eventos?error=callback_error', req.url));
  }
}
