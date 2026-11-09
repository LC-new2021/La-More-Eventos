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

  const twilioSid = (process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID || '').trim();
  const twilioToken = (process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_TOKEN || '').trim();
  const twilioPhone = (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_NUMBER || process.env.TWILIO_FROM || '').trim();
  const twilioConfigured = Boolean(twilioSid && twilioToken && twilioPhone);

  const awsConfigured = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  const webhookConfigured = Boolean(process.env.SMS_API_URL);

  let activeProvider = 'SIMULADO';
  if (awsConfigured) activeProvider = 'AWS_SNS';
  else if (webhookConfigured) activeProvider = 'WEBHOOK_API';
  else if (twilioConfigured) activeProvider = 'TWILIO';

  return NextResponse.json({
    activeProvider,
    twilio: {
      configured: twilioConfigured,
      hasAccountSid: Boolean(twilioSid),
      hasAuthToken: Boolean(twilioToken),
      hasPhoneNumber: Boolean(twilioPhone),
      phoneNumber: twilioPhone
        ? `${twilioPhone.slice(0, 4)}****${twilioPhone.slice(-4)}`
        : null,
    },
    aws: {
      configured: awsConfigured,
    },
    webhook: {
      configured: webhookConfigured,
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

    const twilioConfigured = Boolean(
      (process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID) &&
      (process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_TOKEN) &&
      (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_NUMBER || process.env.TWILIO_FROM)
    );

    const providerNome = process.env.AWS_ACCESS_KEY_ID
      ? 'AWS_SNS'
      : process.env.SMS_API_URL
      ? 'WEBHOOK_API'
      : twilioConfigured
      ? 'TWILIO'
      : 'SIMULADO';

    return NextResponse.json({
      success: resultado.success,
      simulated: resultado.simulated || false,
      messageId: resultado.messageId || null,
      error: resultado.error || null,
      provider: providerNome,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
