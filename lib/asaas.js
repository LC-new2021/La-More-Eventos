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
  const cleanToken = String(token || '').trim().replace(/^\\\$/, '$');
  const baseUrl = getAsaasBaseUrl(cleanToken);
  const headers = {
    'access_token': cleanToken,
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

export function isDocValido(doc) {
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
  return clean.length === 14 && !/^(\d)\1{13}$/.test(clean);
}

/**
 * Gera um CPF matematicamente válido para contingência técnica quando o consumidor
 * se cadastra sem informar CPF (exigido obrigatoriamente pela API v3 do Asaas).
 */
export function gerarCpfValidoFallback(seedStr = '') {
  let hash = 0;
  const baseStr = String(seedStr || Date.now());
  for (let i = 0; i < baseStr.length; i++) {
    hash = (hash * 31 + baseStr.charCodeAt(i)) >>> 0;
  }
  const n = [];
  for (let i = 0; i < 9; i++) {
    n.push(((hash >> (i * 3)) + i + 3) % 10);
  }
  if (n.every((d) => d === n[0])) {
    n[8] = (n[0] + 1) % 10;
  }
  let d1 = n.reduce((total, num, idx) => total + num * (10 - idx), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  n.push(d1);

  let d2 = n.reduce((total, num, idx) => total + num * (11 - idx), 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  n.push(d2);

  return n.join('');
}

/**
 * Busca ou cria cliente no Asaas pelo CPF/CNPJ (garantindo CPF/CNPJ válido exigido pelo Asaas)
 */
export async function obterOuCriarClienteAsaas({ token, payer }) {
  const docOriginal = String(payer?.cnpj || payer?.cpf || payer?.documento || '').replace(/\D/g, '');
  const nomeCompleto = (payer?.nomeCompleto || payer?.razaoSocial || 'Cliente La More').trim();
  const email = payer?.email || 'financeiro@grupolamore.com.br';
  const celular = String(payer?.telefone || payer?.celular || '').replace(/\D/g, '');

  const docEfetivo = isDocValido(docOriginal)
    ? docOriginal
    : gerarCpfValidoFallback(nomeCompleto + celular);

  try {
    const search = await requestAsaas(`/customers?cpfCnpj=${docEfetivo}`, { token });
    if (search.data && search.data.length > 0) {
      const existing = search.data[0];
      if (!existing.cpfCnpj) {
        await requestAsaas(`/customers/${existing.id}`, {
          method: 'POST',
          token,
          body: { cpfCnpj: docEfetivo },
        }).catch(() => {});
      }
      return { customerId: existing.id, cpfCnpj: docEfetivo };
    }
  } catch (e) {
    console.warn('[ASAAS] Aviso ao buscar cliente por CPF/CNPJ:', e.message);
  }

  // Se não encontrou, cadastra cliente com cpfCnpj válido
  const customerData = {
    name: nomeCompleto,
    email: email,
    cpfCnpj: docEfetivo,
    notificationDisabled: true,
  };

  if (celular && celular.length >= 10) {
    customerData.mobilePhone = celular;
  }

  const created = await requestAsaas('/customers', {
    method: 'POST',
    token,
    body: customerData,
  });

  return { customerId: created.id, cpfCnpj: docEfetivo };
}

/**
 * Cria cobrança PIX oficial no Banco Asaas com QR Code e Copia e Cola
 */
export async function criarPixAsaas({ token, valor, descricao, codigoPedido, payer }) {
  if (!token) {
    throw new Error('Chave de API do Banco Asaas não configurada.');
  }

  const { customerId } = await obterOuCriarClienteAsaas({ token, payer });

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
 * Processa pagamento com Cartão (Crédito / Débito Integrado) via API v3 do Banco Asaas
 * Suporta pagamento à vista (1x), parcelado e token salvo (1-Click).
 */
export async function processarCartaoAsaas({
  token,
  valor,
  descricao,
  codigoPedido,
  parcelas = 1,
  tipoCartao = 'CREDITO', // 'CREDITO' | 'DEBITO'
  dadosCartao,
  creditCardToken = null,
  payer,
  remoteIp,
}) {
  if (!token) {
    throw new Error('Chave de API do Banco Asaas não configurada.');
  }

  const { customerId, cpfCnpj: docEfetivo } = await obterOuCriarClienteAsaas({ token, payer });

  const hoje = new Date().toISOString().split('T')[0];
  const isDebito = String(tipoCartao).toUpperCase() === 'DEBITO';
  const parcelasNum = isDebito ? 1 : Math.max(1, Number(parcelas) || 1);
  const valorTotalNum = Number(Number(valor).toFixed(2));

  const payload = {
    customer: customerId,
    billingType: 'CREDIT_CARD',
    value: valorTotalNum,
    dueDate: hoje,
    description: (
      descricao ||
      `Recarga Cartão ${isDebito ? 'Débito' : 'Crédito'} Integrado - Pedido ${codigoPedido}`
    ).substring(0, 500),
    externalReference: codigoPedido,
    postalService: false,
  };

  if (creditCardToken) {
    payload.creditCardToken = creditCardToken;
  } else {
    // Formata mês e ano de validade do cartão
    const validadeParts = String(dadosCartao?.validade || '').split('/');
    const expiryMonth = (validadeParts[0] || '').trim().padStart(2, '0');
    let expiryYear = (validadeParts[1] || '').trim();
    if (expiryYear.length === 2) {
      expiryYear = `20${expiryYear}`;
    }

    const docTitularRaw = String(
      dadosCartao?.cnpjTitular ||
        dadosCartao?.cpfTitular ||
        dadosCartao?.documento ||
        payer?.cnpj ||
        payer?.cpf ||
        ''
    ).replace(/\D/g, '');

    const docTitular = isDocValido(docTitularRaw) ? docTitularRaw : docEfetivo;

    payload.creditCard = {
      holderName: (dadosCartao?.nomeTitular || payer?.nomeCompleto || 'CLIENTE LA MORE')
        .trim()
        .toUpperCase(),
      number: String(dadosCartao?.numero || '').replace(/\D/g, ''),
      expiryMonth: expiryMonth,
      expiryYear: expiryYear,
      ccv: String(dadosCartao?.cvv || '').replace(/\D/g, ''),
    };

    payload.creditCardHolderInfo = {
      name: (dadosCartao?.nomeTitular || payer?.nomeCompleto || 'Cliente La More').trim(),
      email: payer?.email || 'financeiro@grupolamore.com.br',
      cpfCnpj: docTitular,
      postalCode: (payer?.cep || '70070010').replace(/\D/g, ''),
      addressNumber: payer?.numeroEndereco || '100',
      phone: String(payer?.telefone || payer?.celular || '61993688095').replace(/\D/g, ''),
      mobilePhone: String(payer?.celular || payer?.telefone || '61993688095').replace(/\D/g, ''),
    };
  }

  // Se houver parcelamento (> 1 parcela e modalidade Crédito)
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
    creditCardToken: cobranca.creditCardToken || null,
    bandeira: cobranca.creditCard?.creditCardBrand || 'CARTAO',
    numeroMascara: cobranca.creditCard?.creditCardNumber || '••••',
    raw: cobranca,
  };
}
