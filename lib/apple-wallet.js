import { PKPass } from 'passkit-generator';
import fs from 'fs';
import path from 'path';

/**
 * Gera um arquivo .pkpass da Apple Wallet para um Cartão de Consumo
 * @param {Object} cartao - Objeto do cartão contendo codigo e saldo
 * @param {Object} cliente - Objeto do cliente contendo o nome
 * @returns {Promise<Buffer>} - O Buffer do arquivo .pkpass gerado
 */
export async function generateAppleWalletPass(cartao, cliente) {
  // ATENÇÃO: Requer os certificados da Apple Developer Account
  // Para testar, você precisará salvar estes arquivos na raiz do projeto (pasta `certs`)
  // ou passá-los via variáveis de ambiente.
  
  const certsDir = path.join(process.cwd(), 'certs');
  
  try {
    const wwdr = fs.readFileSync(path.join(certsDir, 'wwdr.pem'));
    const signerCert = fs.readFileSync(path.join(certsDir, 'signerCert.pem'));
    const signerKey = fs.readFileSync(path.join(certsDir, 'signerKey.pem'));
    
    // As credenciais devem vir do .env
    const passTypeIdentifier = process.env.APPLE_WALLET_PASS_TYPE_ID || 'pass.com.lamore.eventos';
    const teamIdentifier = process.env.APPLE_WALLET_TEAM_ID || 'TEAMID1234';

    const pass = new PKPass({
      "formatVersion": 1,
      "passTypeIdentifier": passTypeIdentifier,
      "serialNumber": cartao.codigo,
      "teamIdentifier": teamIdentifier,
      "webServiceURL": `${process.env.NEXT_PUBLIC_URL}/api/wallet/apple-webhook`,
      "authenticationToken": `token-${cartao.codigo}`,
      "barcode": {
        "message": cartao.codigo,
        "format": "PKBarcodeFormatQR",
        "messageEncoding": "iso-8859-1",
        "altText": cartao.codigo
      },
      "organizationName": "La More Eventos",
      "description": "Cartão de Consumo Digital",
      "logoText": "La More Eventos",
      "foregroundColor": "rgb(255, 255, 255)",
      "backgroundColor": "rgb(15, 28, 63)",
      "storeCard": {
        "primaryFields": [
          {
            "key": "balance",
            "label": "SALDO ATUAL",
            "value": cartao.saldo || 0,
            "currencyCode": "BRL"
          }
        ],
        "secondaryFields": [
          {
            "key": "clientName",
            "label": "CLIENTE",
            "value": cliente?.nome || "Cliente Padrão"
          }
        ],
        "auxiliaryFields": [
          {
            "key": "cardCode",
            "label": "CÓDIGO",
            "value": cartao.codigo
          }
        ]
      }
    }, {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase: process.env.APPLE_WALLET_KEY_PASSPHRASE // Se a chave tiver senha
    });

    // Se tivermos os ícones configurados, podemos adicioná-lar no pass:
    // pass.addBuffer('icon.png', fs.readFileSync(path.join(process.cwd(), 'public', 'icon.png')));
    // pass.addBuffer('logo.png', fs.readFileSync(path.join(process.cwd(), 'public', 'icon.png')));

    return await pass.getAsBuffer();

  } catch (error) {
    console.error("Erro ao gerar Apple Wallet Pass. Os certificados estão na pasta 'certs'?", error);
    throw new Error("Certificados Apple Wallet ausentes ou inválidos. " + error.message);
  }
}
