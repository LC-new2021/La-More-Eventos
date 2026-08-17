/**
 * Módulo de Disparo de SMS — La More Eventos
 * Suporta provedores de SMS (Zenvia, Twilio, TotalVoice ou Webhook HTTP Genérico)
 */

export async function enviarSmsCartao({ celular, nomeCliente, codigoCartao, hostUrl }) {
  try {
    if (!celular) return { success: false, error: "Celular não informado" };

    const cleanPhone = celular.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      return { success: false, error: "Número de celular inválido" };
    }

    // Formata o número com DDI 55 se necessário
    const formattedPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    
    // Constrói URL do cartão
    const baseUrl = hostUrl || process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://lamoreeventos.com.br';
    const cardUrl = `${baseUrl.replace(/\/$/, '')}/cartao/${codigoCartao.toUpperCase()}`;
    const primeiroNome = (nomeCliente || 'Cliente').split(' ')[0];

    const mensagem = `La More: Ola ${primeiroNome}, seu cartao digital esta pronto! Acesse para recarregar e consumir: ${cardUrl}`;

    console.log(`[SMS] Enviando para ${formattedPhone}: "${mensagem}"`);

    // 1. Provedor AWS SNS (Amazon Web Services)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');
        const snsClient = new SNSClient({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        });

        const command = new PublishCommand({
          PhoneNumber: `+${formattedPhone}`,
          Message: mensagem,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional', // Alta prioridade de entrega instantânea
            },
          },
        });

        const result = await snsClient.send(command);
        console.log(`[SMS AWS SNS] Enviado com sucesso para +${formattedPhone}. MessageId:`, result.MessageId);
        return { success: true, messageId: result.MessageId };
      } catch (snsErr) {
        console.error('[SMS AWS SNS] Erro ao enviar via AWS SNS:', snsErr);
        return { success: false, error: snsErr.message };
      }
    }

    // 2. Provedor Webhook Customizado ou Zenvia
    const smsApiUrl = process.env.SMS_API_URL;
    const smsApiKey = process.env.SMS_API_KEY;

    if (smsApiUrl) {
      const response = await fetch(smsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(smsApiKey ? { 'Authorization': `Bearer ${smsApiKey}`, 'X-API-KEY': smsApiKey } : {})
        },
        body: JSON.stringify({
          to: formattedPhone,
          phone: formattedPhone,
          message: mensagem,
          text: mensagem,
          cartaoCodigo: codigoCartao
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[SMS] Erro ao enviar via API:', errText);
        return { success: false, error: errText };
      }

      console.log(`[SMS] Enviado com sucesso via API para ${formattedPhone}`);
      return { success: true };
    }

    // 2. Provedor Twilio (se configurado)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
      
      const body = new URLSearchParams({
        To: `+${formattedPhone}`,
        From: process.env.TWILIO_PHONE_NUMBER,
        Body: mensagem
      });

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[SMS Twilio] Erro:', errText);
        return { success: false, error: errText };
      }

      console.log(`[SMS Twilio] Enviado com sucesso para ${formattedPhone}`);
      return { success: true };
    }

    // Se nenhum gateway externo estiver configurado nas variáveis de ambiente,
    // o SMS é registrado nos logs do servidor sem quebrar o fluxo.
    console.log(`[SMS Simulado / Log] Destino: ${formattedPhone} | Link: ${cardUrl}`);
    return { success: true, simulated: true };
  } catch (error) {
    console.error('[SMS] Falha geral no disparo de SMS:', error);
    return { success: false, error: error.message };
  }
}
