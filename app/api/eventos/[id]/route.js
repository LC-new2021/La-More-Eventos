import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const evento = await prisma.evento.findUnique({
      where: { id },
      include: {
        usuarios: {
          where: { role: "ORGANIZADOR" },
          select: { gatewayActive: true }
        }
      }
    });
    if (!evento) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    const dbGatewayActive = evento.usuarios?.[0]?.gatewayActive;
    const hasGlobalAsaas = !!process.env.ASAAS_API_KEY;
    const gatewayActive = dbGatewayActive || (hasGlobalAsaas ? "ASAAS" : "NENHUM");
    const { usuarios, ...rest } = evento;
    return NextResponse.json({ ...rest, gatewayActive });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData = {};
    if (body.nome) updateData.nome = body.nome;
    if (body.status) updateData.status = body.status;
    if (body.local) updateData.local = body.local;
    if (body.data) updateData.data = new Date(body.data);
    if (body.taxaMasterPercent !== undefined) {
      updateData.taxaMasterPercent = parseFloat(body.taxaMasterPercent);
    }
    if (body.metodosPagamentoJson !== undefined) {
      updateData.metodosPagamentoJson = body.metodosPagamentoJson;
    }

    const evento = await prisma.evento.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(evento);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
