import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const issuerId = "33880000000023158789";
    const credentialsEnv = process.env.GOOGLE_WALLET_CREDENTIALS;
    const creds = JSON.parse(credentialsEnv);

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

    // Tenta acessar o Issuer diretamente
    const walletRes = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/issuer/${issuerId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`
      }
    });

    const walletData = await walletRes.json();

    // Também tenta listar as classes que o robô enxerga
    const classesRes = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/genericClass?issuerId=${issuerId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`
      }
    });
    const classesData = await classesRes.json();

    return NextResponse.json({
      checkingIssuer: issuerId,
      robotEmail: creds.client_email,
      issuerCheckStatus: walletRes.status,
      issuerCheckResult: walletData,
      classesCheckStatus: classesRes.status,
      classesResult: classesData
    });

  } catch (error) {
    return NextResponse.json({ error: error.message });
  }
}
