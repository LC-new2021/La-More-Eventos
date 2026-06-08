import webpush from 'web-push';

const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BPmym8empnSw5k2J13oHm-EACbUZen3HxKv0tQAPmsQDranlb5Y_YLraQvlRkJYvL77wfFkmldw1gEnMXIqx4lE',
  privateKey: process.env.VAPID_PRIVATE_KEY || '8CK5H-y_LxOpyTOYvBrOR_R8ThsegScBSFgEeYVTgYc'
};

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    'mailto:contato@lamore.com.br',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

export async function enviarNotificacao(pushSubscriptionJson, title, body, url) {
  if (!pushSubscriptionJson) {
    console.log('[Web Push] Nenhuma subscrição ativa para este cliente.');
    return;
  }
  try {
    const subscription = JSON.parse(pushSubscriptionJson);
    const payload = JSON.stringify({ title, body, url });
    await webpush.sendNotification(subscription, payload);
    console.log('[Web Push] Enviado com sucesso!');
  } catch (e) {
    console.error('[Web Push] Falha ao enviar:', e.message);
  }
}
