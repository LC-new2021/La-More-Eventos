// proxy.js — Proteção de rotas por perfil (Next.js 16+)
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export default async function proxy(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/cartao')) {
    return NextResponse.next();
  }

  if (!token) return NextResponse.redirect(new URL('/login', req.url));

  if (pathname.startsWith('/master') && token.role !== 'MASTER')
    return NextResponse.redirect(new URL('/acessos', req.url));
  if (pathname.startsWith('/org') && !['MASTER','ORGANIZADOR'].includes(token.role))
    return NextResponse.redirect(new URL('/acessos', req.url));
  if (pathname.startsWith('/pos') && !['MASTER','CAIXA'].includes(token.role))
    return NextResponse.redirect(new URL('/acessos', req.url));
  if (pathname.startsWith('/bar') && !['MASTER','OPERADOR_BAR'].includes(token.role))
    return NextResponse.redirect(new URL('/acessos', req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/master/:path*', '/org/:path*', '/pos/:path*', '/bar/:path*', '/acessos'],
};
