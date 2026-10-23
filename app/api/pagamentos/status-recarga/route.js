import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { consultarPagamentoAsaas } from '@/lib/asaas';
import { consultarPagamentoMercadoPago } from '@/lib/mercadopago';
import { processarRecargaIdempotente, buscarCartao } from '@/lib/recarga-service';

export const dynamic = 'force-dynamic';

async function obterTokensGateway(evento) {
  let asaasToken = (evento?.asaasToken || process.env.ASAAS_API_KEY || '').trim();
  let mpToken = (evento?.mercadoPagoAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

  if (!asaasToken || !mpToken) {
    const eventos = await prisma.evento.findMany();
    for (const ev of eventos) {
      if (!asaasToken && ev.asaasToken && ev.asaasToken.trim().length > 10) {
        asaasToken = ev.asaasToken.trim();
      }
      if (!mpToken && ev.mercadoPagoAccessToken && ev.mercadoPagoAccessToken.trim().length > 10) {
        mpToken = ev.mercadoPagoAccessToken.trim();
      }
    }
  }

  return { asaasToken, mpToken };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = (searchParams.get('paymentId') || searchParams.get('txid') || '').trim();
    const cartaoCodigo = searchParams.get('cartaoCodigo');

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId obrigatório' }, { status: 400 });
    }

    // 1. Localiza o cartão
    const cartao = await buscarCartao(cartaoCodigo);
    if (!cartao) {
      return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 });
    }

    // 2. Se a transação com este paymentId já foi gravada na base de dados, retorna APROVADO imediatamente
    const movExistente = await prisma.movimentacao.findFirst({
      where: {
        gatewayId: paymentId.toString(),
      },
    });

    if (movExistente) {
      const cartaoAtual = await prisma.cartao.findUnique({
        where: { id: cartao.id },
        include: {
          cliente: true,
          evento: { select: { id: true, nome: true, status: true, gatewayActive: true, mercadoPagoPublicKey: true, modoOperacao: true, permiteDevolucao: true } },
          movimentacoes: {
            orderBy: { criadaEm: 'desc' },
            take: 10,
            include: { produto: { select: { nome: true, preco: true } } },
          },
        },
      });

      return NextResponse.json({
        success: true,
        status: 'APROVADO',
        cartao: cartaoAtual || cartao,
        novoSaldo: (cartaoAtual || cartao).saldo,
      });
    }

    // 3. Consulta em tempo real na API do Banco (Gateway)
    const { asaasToken, mpToken } = await obterTokensGateway(cartao.evento);

    let pagamentoAprovado = false;
    let valorAprovado = 0;
    let gatewayIdEfetivo = paymentId.toString();

    // Se for ID do Asaas (inicia com 'pay_') ou o evento usar Asaas
    if (paymentId.startsWith('pay_') && asaasToken) {
      const asaasData = await consultarPagamentoAsaas({ token: asaasToken, paymentId });
      if (asaasData && (asaasData.status === 'RECEIVED' || asaasData.status === 'CONFIRMED')) {
        pagamentoAprovado = true;
        valorAprovado = parseFloat(asaasData.value || 0);
        gatewayIdEfetivo = asaasData.id;
      }
    }

    // Verificação secundária no Asaas: se o cliente gerou mais de um QR Code para este cartão hoje
    // e pagou um deles, localiza qualquer cobrança RECEIVED/CONFIRMED deste cartão ainda não creditada
    if (!pagamentoAprovado && asaasToken && cartao?.codigo) {
      try {
        const cleanToken = asaasToken.replace(/^\\\$/, '$');
        const isSandbox = cleanToken.toLowerCase().includes('sandbox');
        const baseUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
        const hoje = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString().split('T')[0];
        const listRes = await fetch(`${baseUrl}/payments?dateCreated[ge]=${hoje}&limit=20`, {
          headers: { access_token: cleanToken },
          cache: 'no-store',
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const codUpper = cartao.codigo.toUpperCase();
          for (const p of listData.data || []) {
            if (p.status === 'RECEIVED' || p.status === 'CONFIRMED') {
              const ref = String(p.externalReference || '').toUpperCase();
              const desc = String(p.description || '').toUpperCase();
              if (ref.includes(codUpper) || desc.includes(codUpper)) {
                const jaCreditado = await prisma.movimentacao.findFirst({
                  where: { gatewayId: String(p.id) },
                });
                if (!jaCreditado) {
                  pagamentoAprovado = true;
                  valorAprovado = parseFloat(p.value || 0);
                  gatewayIdEfetivo = String(p.id);
                  break;
                }
              }
            }
          }
        }
      } catch (errScan) {
        console.warn('[STATUS RECARGA] Aviso scan secundário Asaas:', errScan.message);
      }
    }

    // Se não for Asaas nem PIX_DIR_ estático, tenta Mercado Pago
    if (!pagamentoAprovado && !paymentId.startsWith('pay_') && !paymentId.startsWith('PIX_DIR_') && mpToken) {
      const mpData = await consultarPagamentoMercadoPago({ token: mpToken, paymentId });
      if (mpData && mpData.status === 'approved') {
        pagamentoAprovado = true;
        valorAprovado = parseFloat(mpData.transaction_amount || 0);
        gatewayIdEfetivo = String(mpData.id || paymentId);
      }
    }

    // 4. Se o banco confirmou o pagamento, credita de forma IDEMPOTENTE e ATÔMICA
    if (pagamentoAprovado && valorAprovado > 0) {
      const resultado = await processarRecargaIdempotente({
        cartaoId: cartao.id,
        valor: valorAprovado,
        gatewayId: gatewayIdEfetivo,
        gatewayStatus: 'CONFIRMADO',
        descricao: `Recarga Online PIX — ${cartao.evento?.nome || 'La More Eventos'}`,
        operadorNome: 'Gateway Bancário',
      });

      return NextResponse.json({
        success: true,
        status: 'APROVADO',
        cartao: resultado.cartao,
        novoSaldo: resultado.novoSaldo,
        valorRecarregado: valorAprovado,
      });
    }

    // Pagamento ainda pendente no banco
    return NextResponse.json({
      success: true,
      status: 'PENDENTE',
      message: 'Aguardando confirmação do banco.',
    });
  } catch (error) {
    console.error('[ERRO STATUS RECARGA]:', error);
    return NextResponse.json({ error: error.message || 'Erro ao consultar status' }, { status: 500 });
  }
}
