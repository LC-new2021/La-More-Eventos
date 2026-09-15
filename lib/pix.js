/**
 * lib/pix.js
 * Gerador Oficial de BR Code PIX (Padrão Banco Central do Brasil / EMVCo)
 * Produz Copia e Cola e QR Code 100% válidos para qualquer banco brasileiro (Nubank, Itaú, BB, Inter, etc.)
 */
import QRCode from 'qrcode';

function formatField(id, value) {
  const str = String(value ?? '');
  const len = Buffer.byteLength(str, 'utf8').toString().padStart(2, '0');
  return id + len + str;
}

function normalizarTexto(texto, maxLen) {
  if (!texto) return '';
  const semAcentos = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
  return semAcentos.substring(0, maxLen).toUpperCase();
}

export function calcularCRC16(payload) {
  let crc = 0xFFFF;
  const polynomial = 0x1021;
  const bytes = Buffer.from(payload, 'utf8');

  for (let i = 0; i < bytes.length; i++) {
    crc ^= (bytes[i] << 8);
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function formatarChavePix(chave) {
  if (!chave) return '';
  const limpa = chave.trim();

  // E-mail: tudo em minúsculas
  if (limpa.includes('@')) {
    return limpa.toLowerCase();
  }

  // Chave aleatória (UUID): minúsculas
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(limpa)) {
    return limpa.toLowerCase();
  }

  // Limpa caracteres especiais
  const digitos = limpa.replace(/\D/g, '');

  // CNPJ: 14 dígitos
  if (digitos.length === 14) {
    return digitos;
  }

  // Telefone celular com DDD (10 ou 11 dígitos)
  if (!limpa.startsWith('+') && (digitos.length === 10 || (digitos.length === 11 && !limpa.includes('.')))) {
    if (limpa.includes('(') || limpa.includes('-') || !limpa.includes('.')) {
      return `+55${digitos}`;
    }
  }

  // Se já tiver +55
  if (limpa.startsWith('+')) {
    return `+${digitos}`;
  }

  // CPF: 11 dígitos
  if (digitos.length === 11) {
    return digitos;
  }

  return limpa;
}

export function gerarPixCopiaCola({
  chave,
  valor,
  nomeRecebedor = 'LA MORE EVENTOS',
  cidade = 'BRASILIA',
  txid = '***',
  descricao,
}) {
  if (!chave) {
    throw new Error('Chave Pix é obrigatória para gerar o BR Code.');
  }

  const chaveFormatada = formatarChavePix(chave);

  // 00: Payload Format Indicator
  let payload = formatField('00', '01');

  // 26: Merchant Account Information (Padrão Banco Central do Brasil)
  let sub26 = formatField('00', 'br.gov.bcb.pix') + formatField('01', chaveFormatada);
  payload += formatField('26', sub26);

  // 52: Merchant Category Code (0000 = ISO 18245 Geral)
  payload += formatField('52', '0000');

  // 53: Transaction Currency (986 = BRL Real Brasileiro)
  payload += formatField('53', '986');

  // 54: Transaction Amount
  if (valor && Number(valor) > 0) {
    payload += formatField('54', Number(valor).toFixed(2));
  }

  // 58: Country Code (BR)
  payload += formatField('58', 'BR');

  // 59: Merchant Name (máx 25 caracteres, maiúsculas sem acentos)
  payload += formatField('59', normalizarTexto(nomeRecebedor, 25) || 'LA MORE EVENTOS');

  // 60: Merchant City (máx 15 caracteres, maiúsculas sem acentos)
  payload += formatField('60', normalizarTexto(cidade, 15) || 'BRASILIA');

  // 62: Additional Data Field Template (txid)
  payload += formatField('62', formatField('05', '***'));

  // 63: CRC16
  const payloadComIdCrc = payload + '6304';
  const crcCalculado = calcularCRC16(payloadComIdCrc);

  return payloadComIdCrc + crcCalculado;
}

export async function gerarPixCompleto({
  chave,
  valor,
  nomeRecebedor,
  cidade,
  txid,
  descricao,
}) {
  const copiaCola = gerarPixCopiaCola({
    chave,
    valor,
    nomeRecebedor,
    cidade,
    txid,
    descricao,
  });

  const dataUrl = await QRCode.toDataURL(copiaCola, {
    width: 320,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  const base64Puro = dataUrl.replace(/^data:image\/png;base64,/, '');

  return {
    copiaCola,
    qrCodeBase64: base64Puro,
  };
}
