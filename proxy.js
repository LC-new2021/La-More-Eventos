// proxy.js — Proteção de rotas por perfil (Next.js 16+)
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

function buildRedirectUrl(req, targetPath) {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    const cleanHost = forwardedHost.split(',')[0].trim();
    const cleanProto = forwardedProto.split(',')[0].trim();
    return new URL(targetPath, `${cleanProto}://${cleanHost}`);
  }
  const url = req.nextUrl.clone();
  url.pathname = targetPath;
  url.search = '';
  return url;
}

export default async function proxy(req) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || 'lamore-eventos-secret-dev',
  });
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/cartao') ||
    pathname.startsWith('/e/')
  ) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(buildRedirectUrl(req, '/login'));
  }

  const role = token.role;
  const isSupport = ['SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role);

  if (pathname.startsWith('/master') && role !== 'MASTER') {
    return NextResponse.redirect(buildRedirectUrl(req, '/acessos'));
  }

  // Suporte Operacional tem acesso limitado na retaguarda (sem relatórios financeiros e sem configurações de gateway)
  if ((pathname.startsWith('/org/relatorios') || pathname.startsWith('/org/configuracoes')) && isSupport) {
    return NextResponse.redirect(buildRedirectUrl(req, '/org'));
  }

  if (pathname.startsWith('/org') && !['MASTER', 'ORGANIZADOR', 'ORG', 'SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role)) {
    return NextResponse.redirect(buildRedirectUrl(req, '/acessos'));
  }

  if (pathname.startsWith('/pos') && !['MASTER', 'CAIXA', 'CAIXA_VOLANTE', 'TESOURARIA', 'SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role)) {
    return NextResponse.redirect(buildRedirectUrl(req, '/acessos'));
  }

  if (pathname.startsWith('/bar') && !['MASTER', 'OPERADOR_BAR', 'SUPORTE_OPERACIONAL', 'CLIENTE', 'SUPORTE'].includes(role)) {
    return NextResponse.redirect(buildRedirectUrl(req, '/acessos'));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/master/:path*', '/org/:path*', '/pos/:path*', '/bar/:path*', '/acessos'],
};
