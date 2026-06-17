import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
    const credentialsEnv = process.env.GOOGLE_WALLET_CREDENTIALS;

    if (!issuerId || !credentialsEnv) {
      return NextResponse.json({ error: "Credenciais ausentes" });
    }

    const creds = JSON.parse(credentialsEnv);
    const classId = `${issuerId}.lamore_eventos_card`;
    const objectId = `${issuerId}.DEBUG_TESTE_123`;

    const newObject = {
      id: objectId,
      classId: classId,
      logo: {
        sourceUri: {
          uri: `${process.env.NEXT_PUBLIC_URL || 'https://la-more-eventos-production.up.railway.app'}/logo.png`
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
          value: 'Cliente Teste'
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
        type: 'qrCode', // Suspeito de ser o erro (deveria ser QR_CODE)
        value: 'TESTE123',
        alternateText: 'TESTE123'
      }
    };

    // Gera um JWT provisório com a API do Google (simulando OAuth2)
    const jwtHeader = { alg: "RS256", typ: "JWT" };
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const jwtClaim = {
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: "https://oauth2.googleapis.com/token",
      exp: exp,
      iat: iat
    };

    const crypto = require('crypto');
    const b64Url = (str) => Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const header64 = b64Url(JSON.stringify(jwtHeader));
    const claim64 = b64Url(JSON.stringify(jwtClaim));
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header64}.${claim64}`);
    const signature = sign.sign(creds.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const signedJwt = `${header64}.${claim64}.${signature}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${signedJwt}`
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
       return NextResponse.json({ error: "Falha na autenticação do Google", details: tokenData });
    }

    const walletRes = await fetch("https://walletobjects.googleapis.com/walletobjects/v1/genericObject", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newObject)
    });

    const walletData = await walletRes.json();
    return NextResponse.json({
      status: walletRes.status,
      response: walletData
    });

  } catch (error) {
    return NextResponse.json({ error: error.message });
  }
}
