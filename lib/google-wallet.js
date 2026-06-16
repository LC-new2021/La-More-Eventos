import { GoogleAuth } from 'google-auth-library';
import jwt from 'jsonwebtoken';

/**
 * Gera um link "Save to Google Wallet" (Signed JWT) para o Cartão de Consumo
 * @param {Object} cartao - Objeto do cartão contendo codigo e saldo
 * @param {Object} cliente - Objeto do cliente contendo o nome
 * @returns {Promise<string>} - A URL do Google Pay assinada
 */
export async function generateGoogleWalletPassUrl(cartao, cliente) {
  // ATENÇÃO: Requer uma Conta de Serviço do Google Cloud com a Google Wallet API ativada.
  
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID; // O ID do Emissor no Google Pay & Wallet Console
  const classId = `${issuerId}.lamore_eventos_card`;
  const credentialsEnv = process.env.GOOGLE_WALLET_CREDENTIALS;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!issuerId || (!credentialsEnv && !credentialsPath)) {
    throw new Error("Credenciais do Google Wallet não configuradas (GOOGLE_WALLET_CREDENTIALS ou GOOGLE_WALLET_ISSUER_ID).");
  }

  try {
    let authOptions = {
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
    };

    if (credentialsEnv) {
      authOptions.credentials = JSON.parse(credentialsEnv);
    } else {
      authOptions.keyFile = credentialsPath;
    }

    const auth = new GoogleAuth(authOptions);

    const client = await auth.getClient();
    const serviceAccountEmail = client.credentials.client_email;
    const privateKey = client.credentials.private_key;

    // Objeto do Cartão (GenericObject)
    const objectId = `${issuerId}.${cartao.codigo}`;

    const newObject = {
      id: objectId,
      classId: classId,
      logo: {
        sourceUri: {
          uri: `${process.env.NEXT_PUBLIC_URL}/icon.png`
        }
      },
      cardTitle: {
        defaultValue: {
          language: 'pt-BR',
          value: 'La More Eventos'
        }
      },
      header: {
        defaultValue: {
          language: 'pt-BR',
          value: cliente?.nome || 'Cliente'
        }
      },
      subheader: {
        defaultValue: {
          language: 'pt-BR',
          value: 'Cartão de Consumo'
        }
      },
      hexBackgroundColor: '#0F1C3F',
      barcode: {
        type: 'qrCode',
        value: cartao.codigo,
        alternateText: cartao.codigo
      }
    };

    // Criar o JWT para adicionar à carteira
    const claims = {
      iss: serviceAccountEmail,
      aud: 'google',
      typ: 'savetowallet',
      origins: [process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'],
      payload: {
        genericObjects: [newObject]
      }
    };

    const token = jwt.sign(claims, privateKey, { algorithm: 'RS256' });
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    return saveUrl;

  } catch (error) {
    console.error("Erro ao gerar Google Wallet URL:", error);
    throw new Error("Falha ao criar credencial Google Wallet. " + error.message);
  }
}
