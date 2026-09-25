/**
 * lib/mercadopago.js
 * Módulo de Integração Oficial e Real com a API REST do Mercado Pago
 * Suporta PIX Instantâneo Oficial (com QR Code Dinâmico e Copia e Cola)
 * e Cartão de Crédito com Tokenização e Parcelamento.
 */

// 1. Detecta a bandeira do cartão de crédito pelo número
export function detectarBandeiraCartao(numero) {
  const clean = (numero || '').replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(clean)) return 'master';
  if (/^(4011|4389|4514|4576|5041|5066|5090|6277|6362|6363)/.test(clean)) return 'elo';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^(606282|3841)/.test(clean)) return 'hipercard';
  return 'visa';
}

function isDocValido(doc) {
  if (!doc) return false;
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    if (/^(\d)\1{10}$/.test(clean)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(clean.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(clean.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(clean.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(clean.substring(10, 11))) return false;
    return true;
  }
  return clean.length === 14;
}

// 2. Cria cobrança PIX oficial no Mercado Pago
export async function criarPixMercadoPago({ token, valor, descricao, codigoPedido, payer, appUrl }) {
  if (!token) {
    throw new Error('Token do Mercado Pago não configurado.');
  }

  const nomes = (payer.nomeCompleto || payer.razaoSocial || 'Cliente La More').trim().split(' ');
  const primeiroNome = nomes[0] || 'Cliente';
  const sobrenome = nomes.slice(1).join(' ') || 'La More';
  const docLimpo = String(payer.cnpj || payer.cpf || payer.documento || '').replace(/\D/g, '');

  const payload = {
    transaction_amount: Number(Number(valor).toFixed(2)),
    description: (descricao || `Pedido ${codigoPedido} - La More Bilheteria`).substring(0, 60),
    payment_method_id: 'pix',
    payer: {
      email: payer.email || 'contato@grupolamore.com.br',
      first_name: primeiroNome,
      last_name: sobrenome,
    },
    external_reference: codigoPedido,
  };

  // Suporte a CNPJ (14 dígitos) ou CPF (11 dígitos) com dígitos verificadores válidos
  if (isDocValido(docLimpo)) {
    if (docLimpo.length === 14) {
      payload.payer.identification = {
        type: 'CNPJ',
        number: docLimpo,
      };
    } else if (docLimpo.length === 11) {
      payload.payer.identification = {
        type: 'CPF',
        number: docLimpo,
      };
    }
  }

  if (appUrl) {
    payload.notification_url = `${appUrl}/api/webhook/mercadopago`;
  }

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `${codigoPedido}-${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Erro Mercado Pago PIX:', data);
    const causaDesc = data.cause?.[0]?.description || data.message;
    const msg = traduzirErroMercadoPago(null, causaDesc) || causaDesc || 'Erro ao gerar cobrança PIX no Mercado Pago.';
    throw new Error(msg);
  }

  return {
    paymentId: data.id.toString(),
    status: data.status, // 'pending'
    qrCode: data.point_of_interaction?.transaction_data?.qr_code,
    qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64,
    ticketUrl: data.point_of_interaction?.transaction_data?.ticket_url,
  };
}

// 3. Cria token de cartão de crédito no Mercado Pago via REST API
export async function criarCardTokenMercadoPago({ token, dadosCartao }) {
  if (!token) {
    throw new Error('Token do Mercado Pago não configurado.');
  }

  const validadeParts = (dadosCartao.validade || '').split('/');
  const mes = validadeParts[0]?.trim();
  let ano = validadeParts[1]?.trim();
  if (ano && ano.length === 2) {
    ano = `20${ano}`;
  }

  const docCartao = String(dadosCartao.cnpjTitular || dadosCartao.cpfTitular || dadosCartao.documentoTitular || '').replace(/\D/g, '');
  const tipoDoc = docCartao.length === 14 ? 'CNPJ' : 'CPF';

  const payload = {
    card_number: String(dadosCartao.numero || '').replace(/\D/g, ''),
    expiration_month: Number(mes),
    expiration_year: Number(ano),
    security_code: String(dadosCartao.cvv || '').replace(/\D/g, ''),
    cardholder: {
      name: String(dadosCartao.nomeTitular || '').toUpperCase(),
      identification: {
        type: tipoDoc,
        number: docCartao,
      },
    },
  };

  const res = await fetch('https://api.mercadopago.com/v1/card_tokens', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Erro Card Token Mercado Pago:', data);
    const causaDesc = data.cause?.[0]?.description || data.message;
    const msg = traduzirErroMercadoPago(null, causaDesc) || causaDesc || 'Dados do cartão de crédito inválidos ou recusados pelo emissor.';
    throw new Error(msg);
  }

  return data.id;
}

// 4. Processa pagamento com cartão de crédito no Mercado Pago
export async function processarCartaoMercadoPago({ token, valor, descricao, codigoPedido, parcelas, cardToken, bandeira, payer, appUrl }) {
  if (!token) {
    throw new Error('Token do Mercado Pago não configurado.');
  }

  const docPayer = String(payer.cnpj || payer.cpf || payer.documento || '').replace(/\D/g, '');
  const tipoDocPayer = docPayer.length === 14 ? 'CNPJ' : 'CPF';

  const payload = {
    transaction_amount: Number(Number(valor).toFixed(2)),
    token: cardToken,
    description: (descricao || `Pedido ${codigoPedido} - La More Bilheteria`).substring(0, 60),
    installments: Number(parcelas || 1),
    payment_method_id: bandeira || 'visa',
    payer: {
      email: payer.email || 'contato@grupolamore.com.br',
    },
    external_reference: codigoPedido,
  };

  if (docPayer) {
    payload.payer.identification = {
      type: tipoDocPayer,
      number: docPayer,
    };
  }

  if (appUrl) {
    payload.notification_url = `${appUrl}/api/webhook/mercadopago`;
  }

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `${codigoPedido}-${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Erro Pagamento Cartao Mercado Pago:', data);
    const causaDesc = data.cause?.[0]?.description || data.message;
    const msgTraduzida = traduzirErroMercadoPago(data.status_detail, causaDesc);
    const msg = msgTraduzida || causaDesc || 'Pagamento com cartão de crédito recusado.';
    throw new Error(msg);
  }

  return {
    paymentId: data.id.toString(),
    status: data.status, // 'approved', 'in_process', 'rejected'
    statusDetail: data.status_detail,
  };
}

// 5. Consulta pagamento por ID no Mercado Pago
export async function consultarPagamentoMercadoPago({ token, paymentId }) {
  if (!token || !paymentId) return null;

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Erro ao consultar Mercado Pago:', err);
    return null;
  }
}

// Helper: Tradução de mensagens de erro do Mercado Pago para Português amigável
export function traduzirErroMercadoPago(statusDetail, rawError = null) {
  const rawMsg = typeof rawError === 'string' ? rawError : (rawError?.description || rawError?.message || '');

  if (rawMsg.includes('Invalid transaction_amount') || rawMsg.includes('4037')) {
    return 'O valor da transação ou das parcelas é inferior ao limite mínimo permitido pelo Mercado Pago (mínimo de R$ 5,00 por parcela).';
  }
  if (rawMsg.includes('Cannot read property') || rawMsg.includes('invalid_parameter')) {
    return 'Dados do cartão de crédito incompletos ou inválidos. Verifique os dados e tente novamente.';
  }
  if (rawMsg.includes('security_code') || rawMsg.includes('CVV')) {
    return 'Código de segurança (CVV) inválido.';
  }
  if (rawMsg.includes('card_number')) {
    return 'Número de cartão de crédito inválido.';
  }
  if (rawMsg.includes('expiration')) {
    return 'Data de validade do cartão incorreta.';
  }

  const mensagens = {
    cc_rejected_bad_filled_card_number: 'Número de cartão de crédito inválido.',
    cc_rejected_bad_filled_date: 'Data de validade do cartão incorreta.',
    cc_rejected_bad_filled_other: 'Verifique os dados informados do cartão.',
    cc_rejected_bad_filled_security_code: 'Código de segurança (CVV) inválido.',
    cc_rejected_blacklist: 'O pagamento não pôde ser processado. Utilize outro cartão.',
    cc_rejected_call_for_authorize: 'Ligue para a operadora do seu cartão para autorizar a compra.',
    cc_rejected_card_disabled: 'Este cartão está bloqueado ou inativo. Entre em contato com seu banco.',
    cc_rejected_card_error: 'Não foi possível processar o pagamento. Tente novamente.',
    cc_rejected_duplicated_payment: 'Você já realizou um pagamento com esse mesmo valor recentemente.',
    cc_rejected_high_risk: 'Transação recusada por análise de segurança do Mercado Pago.',
    cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente no cartão de crédito.',
    cc_rejected_invalid_installments: 'O número de parcelas selecionado não é permitido para este valor ou cartão (mínimo de R$ 5,00 por parcela).',
    cc_rejected_max_attempts: 'Limite de tentativas excedido. Tente outro cartão ou utilize PIX.',
    cc_rejected_other_reason: 'Pagamento recusado pela instituição financeira.',
  };

  return mensagens[statusDetail] || null;
}
