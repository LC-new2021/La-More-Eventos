/**
 * lib/asaas.js
 * Módulo de Integração Oficial com a API REST do Banco Asaas (v3)
 * Suporta PIX Instantâneo Oficial (com QR Code Dinâmico e Copia e Cola)
 * e Consulta de Status em Tempo Real.
 */

function getAsaasBaseUrl(token) {
  if (process.env.ASAAS_ENVIRONMENT === 'sandbox' || (token && token.toLowerCase().includes('sandbox'))) {
    return 'https://sandbox.asaas.com/api/v3';
  }
  return 'https://api.asaas.com/v3';
}

async function requestAsaas(endpoint, { method = 'GET', token, body = null }) {
  const baseUrl = getAsaasBaseUrl(token);
  const headers = {
    'access_token': token.trim(),
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  // Se der 401 na URL de produção e não for explicitamente sandbox, tenta sandbox como fallback caso a chave seja de teste
  if (res.status === 401 && baseUrl === 'https://api.asaas.com/v3') {
    const sandboxUrl = 'https://sandbox.asaas.com/api/v3';
    try {
      const sandboxRes = await fetch(`${sandboxUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
      if (sandboxRes.ok) {
        return await sandboxRes.json();
      }
    } catch (_) {}
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.errors?.[0]?.description || data.message || `Erro na API do Asaas (${res.status})`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
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

/**
 * Busca ou cria cliente no Asaas pelo CPF/CNPJ
 */
async function obterOuCriarClienteAsaas({ token, payer }) {
  const docLimpo = String(payer.cnpj || payer.cpf || payer.documento || '').replace(/\D/g, '');
  const nomeCompleto = (payer.nomeCompleto || payer.razaoSocial || 'Cliente La More').trim();
  const email = payer.email || 'contato@grupolamore.com.br';
  const celular = String(payer.telefone || payer.celular || '').replace(/\D/g, '');

  const docValido = isDocValido(docLimpo);

  if (docValido) {
    try {
      const search = await requestAsaas(`/customers?cpfCnpj=${docLimpo}`, { token });
      if (search.data && search.data.length > 0) {
        return search.data[0].id;
      }
    } catch (e) {
      console.warn('[ASAAS] Aviso ao buscar cliente por CPF/CNPJ:', e.message);
    }
  }

  // Se não encontrou, cadastra cliente
  const customerData = {
    name: nomeCompleto,
    email: email,
    notificationDisabled: true,
  };

  if (docValido) {
    customerData.cpfCnpj = docLimpo;
  }
  if (celular && celular.length >= 10) {
    customerData.mobilePhone = celular;
  }

  const created = await requestAsaas('/customers', {
    method: 'POST',
    token,
    body: customerData,
  });

  return created.id;
}

/**
 * Cria cobrança PIX oficial no Banco Asaas com QR Code e Copia e Cola
 */
export async function criarPixAsaas({ token, valor, descricao, codigoPedido, payer }) {
  if (!token) {
    throw new Error('Chave de API do Banco Asaas não configurada.');
  }

  const customerId = await obterOuCriarClienteAsaas({ token, payer });

  // Vencimento hoje ou amanhã
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const cobrancaBody = {
    customer: customerId,
    billingType: 'PIX',
    value: Number(Number(valor).toFixed(2)),
    dueDate: amanha,
    description: (descricao || `Pedido ${codigoPedido} - La More Bilheteria`).substring(0, 500),
    externalReference: codigoPedido,
    postalService: false,
  };

  const cobranca = await requestAsaas('/payments', {
    method: 'POST',
    token,
    body: cobrancaBody,
  });

  // Busca dados do PIX (QR Code e Copia e Cola)
  const pixData = await requestAsaas(`/payments/${cobranca.id}/pixQrCode`, { token });

  return {
    paymentId: cobranca.id,
    status: cobranca.status, // 'PENDING'
    qrCode: pixData.payload, // Copia e Cola oficial do Banco Central
    qrCodeBase64: pixData.encodedImage, // Imagem Base64 puro gerada pelo Asaas
    expirationDate: pixData.expirationDate,
  };
}

/**
 * Consulta status de pagamento no Banco Asaas
 */
export async function consultarPagamentoAsaas({ token, paymentId }) {
  if (!token || !paymentId) return null;

  try {
    const data = await requestAsaas(`/payments/${paymentId}`, { token });
    return data;
  } catch (err) {
    console.error('[ASAAS] Erro ao consultar pagamento:', err.message);
    return null;
  }
}

/**
 * Processa pagamento com Cartão de Crédito via API v3 do Banco Asaas
 * Suporta pagamento à vista e parcelado (1x a 12x)
 */
export async function processarCartaoAsaas({
  token,
  valor,
  descricao,
  codigoPedido,
  parcelas = 1,
  dadosCartao,
  payer,
  remoteIp,
}) {
  if (!token) {
    throw new Error('Chave de API do Banco Asaas não configurada.');
  }

  const customerId = await obterOuCriarClienteAsaas({ token, payer });

  // Formata mês e ano de validade do cartão
  const validadeParts = String(dadosCartao.validade || '').split('/');
  const expiryMonth = (validadeParts[0] || '').trim().padStart(2, '0');
  let expiryYear = (validadeParts[1] || '').trim();
  if (expiryYear.length === 2) {
    expiryYear = `20${expiryYear}`;
  }

  const docTitular = String(
    dadosCartao.cnpjTitular || dadosCartao.cpfTitular || dadosCartao.documento || payer.cnpj || payer.cpf || ''
  ).replace(/\D/g, '');

  const hoje = new Date().toISOString().split('T')[0];
  const parcelasNum = Math.max(1, Number(parcelas) || 1);
  const valorTotalNum = Number(Number(valor).toFixed(2));

  const payload = {
    customer: customerId,
    billingType: 'CREDIT_CARD',
    value: valorTotalNum,
    dueDate: hoje,
    description: (descricao || `Pedido ${codigoPedido} - La More Bilheteria`).substring(0, 500),
    externalReference: codigoPedido,
    postalService: false,
    creditCard: {
      holderName: (dadosCartao.nomeTitular || payer.nomeCompleto || '').trim().toUpperCase(),
      number: String(dadosCartao.numero || '').replace(/\D/g, ''),
      expiryMonth: expiryMonth,
      expiryYear: expiryYear,
      ccv: String(dadosCartao.cvv || '').replace(/\D/g, ''),
    },
    creditCardHolderInfo: {
      name: (dadosCartao.nomeTitular || payer.nomeCompleto || '').trim(),
      email: payer.email || 'contato@grupolamore.com.br',
      cpfCnpj: docTitular,
      postalCode: (payer.cep || '70000000').replace(/\D/g, ''),
      addressNumber: payer.numeroEndereco || '0',
      phone: String(payer.telefone || payer.celular || '61999999999').replace(/\D/g, ''),
      mobilePhone: String(payer.celular || payer.telefone || '61999999999').replace(/\D/g, ''),
    },
  };

  // Se houver parcelamento (> 1 parcela)
  if (parcelasNum > 1) {
    payload.installmentCount = parcelasNum;
    payload.installmentValue = Number((valorTotalNum / parcelasNum).toFixed(2));
  }

  if (remoteIp) {
    payload.remoteIp = remoteIp;
  }

  const cobranca = await requestAsaas('/payments', {
    method: 'POST',
    token,
    body: payload,
  });

  return {
    paymentId: cobranca.id,
    status: cobranca.status, // 'CONFIRMED', 'RECEIVED', 'PENDING'
    bandeira: cobranca.creditCard?.creditCardBrand || 'CARTAO',
    numeroMascara: cobranca.creditCard?.creditCardNumber || '••••',
    raw: cobranca,
  };
}
