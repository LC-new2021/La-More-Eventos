"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Script from 'next/script';

function maskCpf(cpf) {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.***.***-${clean.slice(9)}`;
}

function maskPhone(phone) {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) *****-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ****-${clean.slice(6)}`;
  }
  return phone;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function CartaoPage() {
  const { codigo } = useParams();
  const router = useRouter();
  const [cartao, setCartao] = useState(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);

  // Online Recharge States
  const [abrirRecarga, setAbrirRecarga] = useState(false);
  const [valorRecarga, setValorRecarga] = useState('50');
  const [metodoRecarga, setMetodoRecarga] = useState('PIX'); // 'PIX' or 'CARD'
  
  // Card Inputs
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  
  // Payment Processing States
  const [processando, setProcessando] = useState(false);
  const [pixPayload, setPixPayload] = useState('');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState('');
  const [passoRecarga, setPassoRecarga] = useState('valor'); // 'valor', 'checkout', 'sucesso'
  const [recargaErro, setRecargaErro] = useState('');
  const [brickInstance, setBrickInstance] = useState(null);
  const [tabAtiva, setTabAtiva] = useState('PIX'); // 'PIX', 'CARD', 'WALLET'

  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Push notification states
  const [pushPermission, setPushPermission] = useState('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    carregarCartao();
    if (typeof window !== 'undefined') {
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
      setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || false);
      if ('Notification' in window) {
        setPushPermission(Notification.permission);
      }
    }
  }, [codigo]);

  const inscreverPush = async (clienteId) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !clienteId) return;
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrado:', registration.scope);
      
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY ausente no frontend.');
          return;
        }
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }
      
      if (subscription) {
        await fetch('/api/clientes/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clienteId: clienteId,
            subscription
          })
        });
        console.log('Cliente inscrito para push notifications com sucesso!');
      }
    } catch (error) {
      console.warn('Erro ao inscrever cliente em Web Push:', error);
    }
  };

  useEffect(() => {
    if (cartao?.cliente?.id && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      inscreverPush(cartao.cliente.id);
    }
  }, [cartao]);

  const solicitarPermissaoNotificacao = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Seu navegador não oferece suporte para notificações Web Push ou não está sob conexão segura (HTTPS).');
      return;
    }
    setIsSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === 'granted' && cartao?.cliente?.id) {
        await inscreverPush(cartao.cliente.id);
        carregarCartao();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubscribing(false);
    }
  };

  const testarNotificacao = async () => {
    if (!cartao?.cliente?.id) return;
    setTestLoading(true);
    setTestSuccess(false);
    try {
      const res = await fetch('/api/clientes/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: cartao.cliente.id })
      });
      const data = await res.json();
      if (data.success) {
        setTestSuccess(true);
        setTimeout(() => setTestSuccess(false), 5000);
      } else {
        alert('Erro ao enviar notificação de teste: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao processar envio de teste.');
    } finally {
      setTestLoading(false);
    }
  };

  // Polling para confirmação do Pix e carregamento de carteira Mercado Pago
  useEffect(() => {
    let activeInstance = null;

    if (passoRecarga === 'checkout' && tabAtiva === 'WALLET' && cartao?.evento?.mercadoPagoPublicKey && typeof window !== 'undefined' && window.MercadoPago) {
      const container = document.getElementById('paymentCardWalletContainer');
      if (container) {
        container.innerHTML = '';
      }

      try {
        const mp = new window.MercadoPago(cartao.evento.mercadoPagoPublicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();

        bricksBuilder.create('payment', 'paymentCardWalletContainer', {
          initialization: {
            amount: parseFloat(valorRecarga),
            payer: {
              email: cartao.cliente.email || 'financeiro@lamore.com.br'
            }
          },
          customization: {
            paymentMethods: {
              applePay: 'all',
              googlePay: 'all',
              creditCard: 'all',
              debitCard: 'all',
              ticket: 'all',
              bankTransfer: 'all', // Pix
            }
          },
          callbacks: {
            onReady: () => {
              console.log("Mercado Pago Brick is ready");
            },
            onSubmit: ({ selectedPaymentMethod, formData }) => {
              setProcessando(true);
              return new Promise((resolve, reject) => {
                fetch('/api/pagamentos/wallet', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    token: formData.token,
                    paymentMethodId: formData.payment_method_id,
                    issuerId: formData.issuer_id,
                    installments: formData.installments,
                    transactionAmount: formData.transaction_amount,
                    payerEmail: formData.payer.email,
                    cartaoCodigo: cartao.codigo,
                    eventoId: cartao.evento.id
                  })
                })
                .then(res => res.json())
                .then(data => {
                  if (data.success || data.status === 'approved') {
                    setPassoRecarga('sucesso');
                    carregarCartao();
                    resolve();
                  } else {
                    setRecargaErro(data.error || 'Erro ao processar pagamento.');
                    reject();
                  }
                })
                .catch(err => {
                  setRecargaErro('Erro de conexão ao processar carteira.');
                  reject();
                })
                .finally(() => {
                  setProcessando(false);
                });
              });
            },
            onError: (error) => {
              console.error("Brick Error:", error);
              setRecargaErro("Erro ao processar pagamento ou inicializar carteira.");
            }
          }
        }).then(instance => {
          activeInstance = instance;
          setBrickInstance(instance);
        });
      } catch (err) {
        console.error("Error setting up Mercado Pago Brick:", err);
      }
    }

    return () => {
      if (activeInstance && typeof activeInstance.unmount === 'function') {
        activeInstance.unmount();
      }
    };
  }, [passoRecarga, tabAtiva, cartao, valorRecarga]);

  // Polling for Pix recharge payment check
  useEffect(() => {
    let interval;
    if (abrirRecarga && passoRecarga === 'checkout' && tabAtiva === 'PIX' && pixQrCodeUrl) {
      const initialBalance = cartao?.saldo || 0;
      interval = setInterval(() => {
        fetch(`/api/cartao/${codigo}`)
          .then(r => r.json())
          .then(data => {
            if (!data.error && data.saldo > initialBalance) {
              setCartao(data);
              setPassoRecarga('sucesso');
              clearInterval(interval);
            }
          })
          .catch(console.error);
      }, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [abrirRecarga, passoRecarga, tabAtiva, pixQrCodeUrl, codigo, cartao]);

  // Auto-geração do Pix quando a aba muda para PIX
  useEffect(() => {
    if (passoRecarga === 'checkout' && tabAtiva === 'PIX' && !pixQrCodeUrl && !processando) {
      gerarPixOnline();
    }
  }, [passoRecarga, tabAtiva, pixQrCodeUrl]);

  const carregarCartao = () => {
    fetch(`/api/cartao/${codigo}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setErro(data.error);
        else setCartao(data);
      })
      .catch(() => setErro('Erro ao carregar cartão'))
      .finally(() => setLoading(false));
  };

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/pos');
      }
    }
  };

  const gerarPixOnline = async () => {
    setProcessando(true);
    setRecargaErro('');
    try {
      const res = await fetch('/api/pagamentos/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: parseFloat(valorRecarga),
          clienteNome: cartao.cliente.nome,
          cpf: cartao.cliente.cpf || '00000000000',
          eventoId: cartao.eventoId,
          cartaoCodigo: cartao.codigo
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar Pix');
      }
      setPixPayload(data.pixPayload);
      setPixQrCodeUrl(data.qrCodeUrl);
    } catch (err) {
      setRecargaErro(err.message);
    } finally {
      setProcessando(false);
    }
  };

  const processarCartaoOnline = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setProcessando(true);
    setRecargaErro('');

    try {
      const res = await fetch('/api/pagamentos/cartao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: parseFloat(valorRecarga),
          clienteNome: cartao.cliente.nome,
          cpf: cartao.cliente.cpf || '00000000000',
          eventoId: cartao.eventoId,
          cardName,
          cardNumber,
          cardExpiry,
          cardCvc,
          cartaoCodigo: cartao.codigo
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro na transação de cartão');
      }
      if (data.confirmado) {
        setPassoRecarga('sucesso');
        carregarCartao();
      } else {
        throw new Error('A transação não foi aprovada pela operadora.');
      }
    } catch (err) {
      setRecargaErro(err.message);
    } finally {
      setProcessando(false);
    }
  };

  // Simulação rápida para desenvolvedor (Pix Simulado)
  const simularWebhookPix = async () => {
    setProcessando(true);
    try {
      const mockAsaasWebhookUrl = `/api/webhooks/asaas`;
      const res = await fetch(mockAsaasWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'PAYMENT_RECEIVED',
          payment: {
            id: 'mock_pay_123',
            externalReference: `RECARGA_PIX_${cartao.codigo}`,
            value: parseFloat(valorRecarga)
          }
        })
      });
      if (res.ok) {
        setPassoRecarga('sucesso');
        carregarCartao();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessando(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0F1C3F] flex items-center justify-center">
      <p className="text-white text-2xl font-bold">Carregando cartão digital...</p>
    </div>
  );

  if (erro) return (
    <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-6 text-center">
      <span className="text-8xl mb-4">💳</span>
      <h1 className="text-3xl font-black text-white">{erro}</h1>
      <p className="text-red-200 mt-2 font-semibold">Verifique se o código está correto ou se o cartão foi emitido.</p>
      <button 
        onClick={handleBack} 
        className="mt-6 bg-white text-red-600 font-bold px-6 py-2.5 rounded-xl"
      >
        ← Voltar
      </button>
    </div>
  );

  const dataFormatada = (d) => new Date(d).toLocaleString('pt-BR');
  const isFestaBarco = (cartao.evento.nome || '').toLowerCase().includes('barco') || (cartao.evento.nome || '').toLowerCase().includes('summer');
  const cardUrl = typeof window !== 'undefined' ? window.location.href : '';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(cardUrl)}`;

  return (
    <div className="min-h-screen bg-[#0F1C3F] p-5 flex flex-col justify-between relative">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center">
        


        {/* CABEÇALHO DO EVENTO */}
        <div className="text-center mb-6">
          <p className="text-blue-300 font-bold text-xs uppercase tracking-widest">Cartão de Consumação</p>
          <h2 className="text-2xl font-black text-white mt-1">{cartao.evento.nome}</h2>
        </div>

        {/* CARTÃO VIRTUAL PREMIUM */}
        <div className="relative w-full min-h-[280px] rounded-[2rem] p-6 text-white overflow-hidden shadow-2xl transition-transform hover:scale-[1.02] duration-300 border border-white/10 flex flex-col justify-between bg-gradient-to-br from-[#1E3A8A] via-[#0D9488] to-[#0F172A] mb-4">
          
          {/* Marca d'água */}
          {isFestaBarco ? (
            <div className="absolute right-[25%] bottom-[-15%] text-[14rem] opacity-5 select-none pointer-events-none font-bold italic rotate-[-12deg]">⚓</div>
          ) : (
            <div className="absolute right-[25%] bottom-[-15%] text-[14rem] opacity-5 select-none pointer-events-none font-bold italic rotate-[-12deg]">🎫</div>
          )}

          {/* Top: Chip (left) and Brand Header (right) */}
          <div className="flex justify-between items-center z-10">
            <div className="w-12 h-9 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 rounded-lg border border-amber-300/40 relative overflow-hidden flex items-center justify-center opacity-90">
              <div className="absolute inset-y-0 left-1/3 w-[1px] bg-amber-600/30" />
              <div className="absolute inset-y-0 right-1/3 w-[1px] bg-amber-600/30" />
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-amber-600/30" />
            </div>
            <div className="text-right">
              <h1 className="text-xl font-black tracking-wider leading-none">La More Eventos</h1>
              <p className="text-[9px] text-teal-200 font-bold tracking-widest mt-0.5 uppercase">Cartão Digital Oficial</p>
            </div>
          </div>

          {/* Mid: Saldo (left) and QR Code (right) */}
          <div className="flex justify-between items-center z-10 my-2">
            <div>
              <p className="text-[10px] text-teal-100/70 font-black uppercase tracking-wider">Saldo Disponível</p>
              <p className="text-3xl font-black tracking-tight">R$ {cartao.saldo.toFixed(2).replace('.', ',')}</p>
            </div>
            {cartao.status === 'ATIVO' && (
              <div className="bg-white p-1 rounded-xl shadow-lg border border-white/10 shrink-0">
                <img src={qrCodeUrl} alt="QR Code Consumação" className="w-32 h-32" />
              </div>
            )}
          </div>

          {/* Bottom Card (Client Info) */}
          <div className="flex justify-between items-end z-10">
            <div className="max-w-[70%]">
              <p className="text-[10px] text-teal-100/70 font-black uppercase tracking-wider">Cliente</p>
              <p className="text-lg font-bold truncate leading-tight">{cartao.cliente.nome}</p>
              <div className="flex gap-3 text-[10px] text-teal-200 mt-0.5 font-semibold">
                {cartao.cliente.cpf && <span>CPF: {maskCpf(cartao.cliente.cpf)}</span>}
                {cartao.cliente.celular && <span>Tel: {maskPhone(cartao.cliente.celular)}</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-teal-100/50 font-black uppercase tracking-wider">Código</p>
              <p className="text-base font-black tracking-widest">{cartao.codigo}</p>
            </div>
          </div>
        </div>

        {/* STATUS BAR */}
        <div className={`rounded-2xl p-3 text-center mb-4 font-black text-sm shadow-md ${
          cartao.status === 'ATIVO' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          {cartao.status === 'ATIVO' ? '● CARTÃO DIGITAL ATIVO' : '🔒 CARTÃO BLOQUEADO / INATIVO'}
        </div>

        {/* PWA & WEB PUSH NOTIFICATION SYSTEM */}
        {cartao.status === 'ATIVO' && (
          <div className="bg-white/5 rounded-3xl p-5 border border-white/5 shadow-inner mb-4 text-left">
            <h3 className="text-white font-black text-lg flex items-center gap-2 mb-2">
              <span>🔔</span> Notificações do Cartão
            </h3>
            
            {/* iOS and NOT standalone */}
            {isIOS && !isStandalone && (
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-xs text-blue-200/80 leading-relaxed mb-2">
                <p className="font-bold text-white mb-1">📲 Requisito do iPhone (iOS):</p>
                Para receber alertas de saldo na tela:
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Toque no botão de <strong>Compartilhar</strong> (seta para cima no Safari)</li>
                  <li>Selecione <strong>"Adicionar à Tela de Início"</strong></li>
                  <li>Abra o app a partir da tela inicial e clique em <strong>Ativar Notificações</strong> por lá.</li>
                </ol>
              </div>
            )}

            {/* Permission: GRANTED */}
            {pushPermission === 'granted' && (
              <div className="space-y-3">
                <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 flex items-start gap-3">
                  <span className="text-xl">✅</span>
                  <div>
                    <p className="text-emerald-300 font-bold text-sm">Notificações Ativas</p>
                    <p className="text-[10px] text-emerald-400/70 leading-tight mt-0.5">Você receberá um alerta imediato na tela do celular sempre que houver recarga ou consumo.</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={testarNotificacao}
                  disabled={testLoading}
                  className="w-full bg-[#0D9488]/30 hover:bg-[#0D9488]/50 border border-[#0D9488]/50 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  style={{ minHeight: "36px" }}
                >
                  {testLoading ? 'Enviando teste...' : '🔔 Testar Notificação na Tela'}
                </button>
                {testSuccess && (
                  <p className="text-center text-[10px] text-emerald-400 font-semibold animate-pulse mt-1">
                    Notificação enviada! Verifique a tela do seu celular.
                  </p>
                )}
              </div>
            )}

            {/* Permission: DENIED */}
            {pushPermission === 'denied' && (
              <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="text-rose-300 font-bold text-sm">Notificações Bloqueadas</p>
                  <p className="text-[10px] text-rose-400/70 leading-normal mt-0.5">
                    As notificações foram bloqueadas nas configurações do seu navegador para este site. 
                    Para receber alertas de saldo, acesse as permissões do site na barra de endereços e permita as notificações.
                  </p>
                </div>
              </div>
            )}

            {/* Permission: DEFAULT (Prompt option) */}
            {pushPermission === 'default' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-blue-200/80 leading-normal">
                  Deseja receber avisos de saldo na tela do celular quando fizer recargas ou retirar produtos no bar?
                </p>
                <button
                  onClick={solicitarPermissaoNotificacao}
                  disabled={isSubscribing}
                  className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white font-black text-sm py-3 rounded-2xl transition-all shadow flex items-center justify-center gap-2 cursor-pointer"
                  style={{ minHeight: "44px" }}
                >
                  {isSubscribing ? 'Ativando...' : '🔔 Ativar Notificações de Saldo'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* RECARGA RAPIDA ONLINE */}
        {cartao.status === 'ATIVO' && (
          <div className="bg-white/5 rounded-3xl p-5 border border-white/5 shadow-inner mb-4 flex flex-col gap-3">
            <h3 className="text-white font-black text-lg flex items-center gap-2"><span>⚡</span> Recarga Rápida Online</h3>
            <p className="text-xs text-blue-200">Adicione saldo ao seu cartão de consumação instantaneamente via Pix ou Cartão de Crédito.</p>
            <button 
              onClick={() => {
                setAbrirRecarga(true);
                setPassoRecarga('valor');
                setTabAtiva(cartao?.evento?.mercadoPagoPublicKey ? 'WALLET' : 'PIX');
                setRecargaErro('');
              }} 
              className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white font-black py-4 rounded-2xl transition-all shadow-lg text-lg flex items-center justify-center gap-2"
              style={{ minHeight: "52px" }}
            >
              💳 Recarregar Saldo
            </button>
          </div>
        )}

        {/* HISTÓRICO DE MOVIMENTAÇÕES */}
        {cartao.movimentacoes.length > 0 && (
          <div className="bg-white/5 rounded-3xl p-5 border border-white/5 shadow-inner mb-6">
            <h3 className="text-white font-black text-lg mb-3 flex items-center gap-2">
              <span>🧾</span> Histórico de Uso
            </h3>
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {cartao.movimentacoes.map((m) => (
                <div key={m.id} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-white font-bold text-sm">{m.descricao || m.produto?.nome || m.tipo}</p>
                    <p className="text-blue-300/60 text-xs font-semibold">{dataFormatada(m.criadaEm)}</p>
                  </div>
                  <p className={`font-black text-base ${m.tipo === 'RECARGA' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {m.tipo === 'RECARGA' ? '+' : '-'} R$ {m.valor.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* TERMOS DE USO OBRIGATÓRIOS (BOTTOM) */}
      <div className="max-w-md mx-auto w-full text-center py-4 border-t border-white/10">
        <p className="text-[11px] text-blue-200/60 font-bold leading-normal">
          * Em caso de saldo não consumido, não haverá devolução e o valor restante será doado.
        </p>
        <p className="text-[10px] text-blue-300/40 mt-1">
          La More Eventos © {new Date().getFullYear()}
        </p>
      </div>

      {/* MODAL DE RECARGA */}
      {abrirRecarga && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white text-gray-900 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
            {/* Fechar */}
            <button 
              onClick={() => setAbrirRecarga(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-900 font-black text-xl"
            >
              ✕
            </button>

            {passoRecarga === 'valor' && (
              <>
                <h3 className="text-2xl font-black text-[#1E3A8A] mb-4">Escolha o Valor</h3>
                
                {/* Campo Valor */}
                <div className="bg-gray-50 border-2 border-gray-100 rounded-3xl p-5 text-center mb-6">
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Valor da Recarga</p>
                  <div className="flex justify-center items-center gap-1">
                    <span className="text-3xl font-black text-[#1E3A8A]">R$</span>
                    <input 
                      type="number" 
                      value={valorRecarga} 
                      onChange={(e) => setValorRecarga(e.target.value)}
                      className="text-4xl font-black text-[#1E3A8A] bg-transparent outline-none w-32 text-center"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                {/* Grid valores fixos */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {['30', '50', '100', '150', '200', '300'].map(v => (
                    <button 
                      key={v}
                      onClick={() => setValorRecarga(v)}
                      className={`py-3 rounded-2xl font-black transition-colors ${
                        valorRecarga === v 
                          ? 'bg-[#0D9488] text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      R$ {v}
                    </button>
                  ))}
                </div>

                {recargaErro && <p className="text-red-500 font-bold text-sm mb-4 text-center">{recargaErro}</p>}

                <button 
                  onClick={() => {
                    setPassoRecarga('checkout');
                  }}
                  disabled={!valorRecarga || parseFloat(valorRecarga) <= 5}
                  className="w-full bg-[#1E3A8A] hover:bg-[#152A66] text-white font-black py-4 rounded-2xl transition-all shadow-lg text-lg flex items-center justify-center gap-2"
                  style={{ minHeight: "52px" }}
                >
                  Avançar para Checkout →
                </button>
                <p className="text-[10px] text-gray-400 text-center mt-2">Valor mínimo de recarga online: R$ 5,00</p>
              </>
            )}

            {passoRecarga === 'checkout' && (
              <>
                <h3 className="text-xl font-black text-[#1E3A8A] mb-1">Recarga de Saldo</h3>
                <p className="text-xs font-bold text-gray-400 mb-4 text-center">Valor: R$ {parseFloat(valorRecarga).toFixed(2).replace('.', ',')}</p>

                {/* Tabs Selector */}
                <div className="flex border-b border-gray-100 mb-5 w-full">
                  {cartao?.evento?.mercadoPagoPublicKey && (
                    <button
                      onClick={() => {
                        setRecargaErro('');
                        setTabAtiva('WALLET');
                      }}
                      className={`flex-1 pb-2.5 text-center font-black text-xs transition-all border-b-2 ${
                        tabAtiva === 'WALLET'
                          ? 'border-[#1E3A8A] text-[#1E3A8A]'
                          : 'border-transparent text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      📱 Carteira
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setRecargaErro('');
                      setTabAtiva('PIX');
                    }}
                    className={`flex-1 pb-2.5 text-center font-black text-xs transition-all border-b-2 ${
                      tabAtiva === 'PIX'
                        ? 'border-[#1E3A8A] text-[#1E3A8A]'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    🟢 Pix
                  </button>
                  <button
                    onClick={() => {
                      setRecargaErro('');
                      setTabAtiva('CARD');
                    }}
                    className={`flex-1 pb-2.5 text-center font-black text-xs transition-all border-b-2 ${
                      tabAtiva === 'CARD'
                        ? 'border-[#1E3A8A] text-[#1E3A8A]'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    💳 Cartão
                  </button>
                </div>

                {/* Content: WALLET */}
                {tabAtiva === 'WALLET' && cartao?.evento?.mercadoPagoPublicKey && (
                  <div className="w-full text-center">
                    <p className="text-[11px] text-gray-400 mb-4">Pague usando Apple Pay, Google Pay ou Cartão via Mercado Pago.</p>
                    <div id="paymentCardWalletContainer" className="w-full min-h-[150px] mb-6 animate-fade-in" />
                  </div>
                )}

                {/* Content: PIX */}
                {tabAtiva === 'PIX' && (
                  <div className="text-center w-full">
                    {processando && !pixQrCodeUrl ? (
                      <div className="py-12 text-center text-xs font-bold text-gray-400 animate-pulse">Gerando Pix...</div>
                    ) : pixQrCodeUrl ? (
                      <>
                        <img src={pixQrCodeUrl} alt="QR Code Pix" className="w-44 h-44 mx-auto mb-4 border border-gray-100 rounded-2xl p-2" />
                        
                        <div className="mb-4">
                          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">Código Copia e Cola</p>
                          <input 
                            type="text"
                            readOnly
                            value={pixPayload}
                            onClick={(e) => {
                              e.target.select();
                              navigator.clipboard.writeText(pixPayload);
                              alert('Pix Copia e Cola copiado!');
                            }}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-center cursor-pointer select-all truncate"
                            title="Clique para copiar"
                          />
                          <p className="text-[9px] text-gray-400 mt-1">Toque no campo acima para copiar</p>
                        </div>

                        <button 
                          onClick={simularWebhookPix}
                          disabled={processando}
                          className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-2.5 rounded-xl transition-all mb-2 text-xs shadow"
                        >
                          {processando ? 'Confirmando...' : '⚡ Confirmar Pix (Simulação)'}
                        </button>
                      </>
                    ) : (
                      <div className="py-12 text-center text-xs font-bold text-red-500">Erro ao carregar Pix. Tente novamente.</div>
                    )}
                  </div>
                )}

                {/* Content: CARD */}
                {tabAtiva === 'CARD' && (
                  <form onSubmit={processarCartaoOnline} className="space-y-3 w-full text-left">
                    <div>
                      <label className="block text-gray-500 font-bold mb-0.5 text-xs">Nome Impresso no Cartão</label>
                      <input 
                        type="text" 
                        required 
                        value={cardName} 
                        onChange={e => setCardName(e.target.value)} 
                        placeholder="JOAO S SILVA" 
                        className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1E3A8A] focus:bg-white outline-none rounded-xl px-3 py-1.5 font-semibold transition-all text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-500 font-bold mb-0.5 text-xs">Número do Cartão</label>
                      <input 
                        type="text" 
                        required 
                        value={cardNumber} 
                        onChange={e => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19))} 
                        placeholder="0000 0000 0000 0000" 
                        className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1E3A8A] focus:bg-white outline-none rounded-xl px-3 py-1.5 font-semibold transition-all text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-gray-500 font-bold mb-0.5 text-xs">Validade</label>
                        <input 
                          type="text" 
                          required 
                          value={cardExpiry} 
                          onChange={e => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2, 4);
                            setCardExpiry(val.slice(0, 5));
                          }} 
                          placeholder="MM/AA" 
                          className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1E3A8A] focus:bg-white outline-none rounded-xl px-3 py-1.5 font-semibold transition-all text-xs text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 font-bold mb-0.5 text-xs">Código (CVC)</label>
                        <input 
                          type="text" 
                          required 
                          value={cardCvc} 
                          onChange={e => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} 
                          placeholder="123" 
                          className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1E3A8A] focus:bg-white outline-none rounded-xl px-3 py-1.5 font-semibold transition-all text-xs text-center"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={processando}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-2.5 rounded-xl transition-all text-xs shadow"
                    >
                      {processando ? 'Processando...' : 'Pagar Agora'}
                    </button>
                  </form>
                )}

                {recargaErro && <p className="text-red-500 font-bold text-xs text-center my-2">{recargaErro}</p>}

                {/* Voltar button for Checkout screen */}
                <div className="mt-4 pt-3 border-t border-gray-100 w-full">
                  <button 
                    onClick={() => {
                      if (brickInstance && typeof brickInstance.unmount === 'function') {
                        brickInstance.unmount();
                      }
                      setBrickInstance(null);
                      setPixQrCodeUrl('');
                      setPixPayload('');
                      setRecargaErro('');
                      setPassoRecarga('valor');
                    }}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold py-2.5 rounded-xl transition-all text-xs"
                  >
                    Voltar / Alterar Valor
                  </button>
                </div>
              </>
            )}

            {passoRecarga === 'sucesso' && (
              <div className="text-center py-6">
                <span className="text-6xl block mb-4">🎉</span>
                <h3 className="text-2xl font-black text-[#1E3A8A] mb-2">Recarga Aprovada!</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Seus créditos de <span className="font-bold text-gray-900">R$ {parseFloat(valorRecarga).toFixed(2).replace('.', ',')}</span> já foram adicionados ao seu saldo.
                </p>
                <button 
                  onClick={() => {
                    setAbrirRecarga(false);
                    carregarCartao();
                  }}
                  className="w-full bg-[#1E3A8A] text-white font-black py-4 rounded-xl shadow-lg"
                >
                  Visualizar Meu Saldo
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      <Script src="https://sdk.mercadopago.com/js/v2" strategy="lazyOnload" />

    </div>
  );
}
