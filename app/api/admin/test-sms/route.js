import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { enviarSmsCartao } from '@/lib/sms';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'MASTER') {
    return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 403 });
  }

  const hasTwilioSid = Boolean(process.env.TWILIO_ACCOUNT_SID);
  const hasTwilioToken = Boolean(process.env.TWILIO_AUTH_TOKEN);
  const hasTwilioPhone = Boolean(process.env.TWILIO_PHONE_NUMBER);
  const twilioConfigured = hasTwilioSid && hasTwilioToken && hasTwilioPhone;

  const hasAwsKey = Boolean(process.env.AWS_ACCESS_KEY_ID);
  const hasAwsSecret = Boolean(process.env.AWS_SECRET_ACCESS_KEY);
  const awsConfigured = hasAwsKey && hasAwsSecret;

  const hasSmsApiUrl = Boolean(process.env.SMS_API_URL);

  let activeProvider = 'SIMULADO';
  if (awsConfigured) activeProvider = 'AWS_SNS';
  else if (hasSmsApiUrl) activeProvider = 'WEBHOOK_API';
  else if (twilioConfigured) activeProvider = 'TWILIO';

  return NextResponse.json({
    activeProvider,
    twilio: {
      configured: twilioConfigured,
      hasAccountSid: hasTwilioSid,
      hasAuthToken: hasTwilioToken,
      hasPhoneNumber: hasTwilioPhone,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
        ? `${process.env.TWILIO_PHONE_NUMBER.slice(0, 4)}****${process.env.TWILIO_PHONE_NUMBER.slice(-4)}`
        : null,
    },
    aws: {
      configured: awsConfigured,
    },
    webhook: {
      configured: hasSmsApiUrl,
    },
  });
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const celular = body.celular;

    if (!celular) {
      return NextResponse.json({ error: 'Número de celular não informado' }, { status: 400 });
    }

    const hostUrl = req.headers.get('origin') || process.env.NEXTAUTH_URL;
    const resultado = await enviarSmsCartao({
      celular,
      nomeCliente: 'Cliente Teste',
      codigoCartao: 'TESTE-SMS',
      hostUrl,
    });

    return NextResponse.json({
      success: resultado.success,
      simulated: resultado.simulated || false,
      messageId: resultado.messageId || null,
      error: resultado.error || null,
      provider: process.env.AWS_ACCESS_KEY_ID
        ? 'AWS_SNS'
        : process.env.SMS_API_URL
        ? 'WEBHOOK_API'
        : process.env.TWILIO_ACCOUNT_SID
        ? 'TWILIO'
        : 'SIMULADO (Nenhuma variável externa encontrada no servidor)',
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
