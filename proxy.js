// proxy.js — Proteção de rotas por perfil (Next.js 16+)
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export default async function proxy(req) {
  const secret = process.env.NEXTAUTH_SECRET || 'lamore-eventos-secret-dev';
  let token = await getToken({ req, secret });
  if (!token) {
    token = await getToken({ req, secret, secureCookie: true });
  }
  if (!token) {
    token = await getToken({ req, secret, secureCookie: false });
  }

  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/cartao') ||
    pathname.startsWith('/e/')
  ) {
    return NextResponse.next();
  }

  if (!token) return NextResponse.redirect(new URL('/login', req.url));

  const role = token.role;
  const isSupport = ['SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role);

  if (pathname.startsWith('/master') && role !== 'MASTER')
    return NextResponse.redirect(new URL('/acessos', req.url));

  if ((pathname.startsWith('/org/relatorios') || pathname.startsWith('/org/configuracoes')) && isSupport)
    return NextResponse.redirect(new URL('/org', req.url));

  if (pathname.startsWith('/org') && !['MASTER', 'ORGANIZADOR', 'ORG', 'SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role))
    return NextResponse.redirect(new URL('/acessos', req.url));

  if (pathname.startsWith('/pos') && !['MASTER', 'CAIXA', 'CAIXA_VOLANTE', 'TESOURARIA', 'SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role))
    return NextResponse.redirect(new URL('/acessos', req.url));

  if (pathname.startsWith('/bar') && !['MASTER', 'OPERADOR_BAR', 'SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role))
    return NextResponse.redirect(new URL('/acessos', req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/master/:path*', '/org/:path*', '/pos/:path*', '/bar/:path*', '/acessos'],
};
