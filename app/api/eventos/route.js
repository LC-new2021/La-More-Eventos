import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const DEFAULT_TEXTO_AVISO_SALDO = 'Não há devolução de saldo ao final da festa, porém o saldo positivo pode ser utilizado durante todos os dias da festa.';

function extractAvisoSaldo(evento) {
  let exibirAvisoSaldo = true;
  let textoAvisoSaldo = DEFAULT_TEXTO_AVISO_SALDO;
  if (evento?.pagbankKey) {
    try {
      const parsed = JSON.parse(evento.pagbankKey);
      if (parsed && typeof parsed === 'object') {
        if (parsed.exibirAvisoSaldo !== undefined) exibirAvisoSaldo = Boolean(parsed.exibirAvisoSaldo);
        if (typeof parsed.textoAvisoSaldo === 'string') textoAvisoSaldo = parsed.textoAvisoSaldo;
      }
    } catch {}
  }
  return { exibirAvisoSaldo, textoAvisoSaldo };
}

function parseEventDate(dateStr) {
  if (!dateStr) return new Date();
  const str = String(dateStr).trim();
  const datePart = str.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return new Date(`${datePart}T12:00:00.000Z`);
  }
  return new Date(str);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const eventos = await prisma.evento.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: { select: { cartoes: true, produtos: true, usuarios: true } },
      },
    });

    const isAuthorized = session && ['MASTER', 'ORGANIZADOR'].includes(session.user.role);

    const safeEventos = eventos.map(evento => {
      const aviso = extractAvisoSaldo(evento);
      const safe = { ...evento, ...aviso };
      if (!isAuthorized) {
        delete safe.asaasToken;
        delete safe.asaasUrl;
        delete safe.pagbankToken;
        delete safe.pagbankKey;
        delete safe.mercadoPagoAccessToken;
        delete safe.mercadoPagoRefreshToken;
      }
      return safe;
    });

    return NextResponse.json(safeEventos);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    const body = await req.json();
    const avisoConfig = {
      exibirAvisoSaldo: body.exibirAvisoSaldo !== undefined ? Boolean(body.exibirAvisoSaldo) : true,
      textoAvisoSaldo: body.textoAvisoSaldo !== undefined ? body.textoAvisoSaldo : DEFAULT_TEXTO_AVISO_SALDO,
    };
    const evento = await prisma.evento.create({
      data: {
        nome: body.nome,
        data: parseEventDate(body.data),
        local: body.local,
        taxaMasterPercent: parseFloat(body.taxaMasterPercent) || 5,
        status: 'CONFIGURANDO',
        gatewayActive: body.gatewayActive || 'PIX_DIRETO',
        chavePix: body.chavePix || null,
        tipoChavePix: body.tipoChavePix || 'CPF',
        titularPix: body.titularPix || null,
        cidadePix: body.cidadePix || 'BRASILIA',
        asaasToken: body.asaasToken || null,
        mercadoPagoPublicKey: body.mercadoPagoPublicKey || null,
        mercadoPagoAccessToken: body.mercadoPagoAccessToken || null,
        permiteDevolucao: body.permiteDevolucao || false,
        permitirEdicaoGateway: body.permitirEdicaoGateway || false,
        pagbankKey: JSON.stringify(avisoConfig),
        bilheteriaEventoId: body.bilheteriaEventoId || null,
      },
    });
    return NextResponse.json({ ...evento, ...avisoConfig }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
