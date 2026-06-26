"use client";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

function formatarCpf(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
function formatarTel(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
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

export default function PosApp() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [etapa, setEtapa] = useState("inicio");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [celular, setCelular] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [pagamentos, setPagamentos] = useState([]);
  const [metodoAtual, setMetodoAtual] = useState("");
  const [valorRecebido, setValorRecebido] = useState("");
  const [codigoCartao, setCodigoCartao] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  // Métodos de Pagamento Dinâmicos espelhados
  const [metodosPagamento, setMetodosPagamento] = useState([
    { id: "pix", label: "Pix", emoji: "🟢", ativo: true },
    { id: "cartao", label: "Cartão", emoji: "💳", ativo: true },
    { id: "dinheiro", label: "Dinheiro", emoji: "💵", ativo: true, troco: true },
  ]);

  // Pix Dinâmico PagBank
  const [gerandoPix, setGerandoPix] = useState(false);
  const [pixQrCode, setPixQrCode] = useState("");
  const [pixCopiaCola, setPixCopiaCola] = useState("");
  const [pixTxid, setPixTxid] = useState("");
  const [pixGerado, setPixGerado] = useState(false);

  // Busca
  const [termoBusca, setTermoBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [cartaoEncontrado, setCartaoEncontrado] = useState(null);
  
  // Cartão Salvo (Asaas Tokenization)
  const [savedCardToken, setSavedCardToken] = useState("");
  const [savedCardBrand, setSavedCardBrand] = useState("");
  const [savedCardLastDigits, setSavedCardLastDigits] = useState("");
  const [usarCartaoSalvo, setUsarCartaoSalvo] = useState(false);

  // Master Test support
  const [eventosMaster, setEventosMaster] = useState([]);
  const [selectedEventoId, setSelectedEventoId] = useState("");

  // Estado do evento completo
  const [evento, setEvento] = useState(null);

  // Cartão Online (Asaas)
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [processandoCartao, setProcessandoCartao] = useState(false);
  const [usarCheckoutOffline, setUsarCheckoutOffline] = useState(false);

  // Estados para Notificações Push do Caixa
  const [pushPermission, setPushPermission] = useState('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const inscreverPushUsuario = async (userId) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !userId) return;
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BPmym8empnSw5k2J13oHm-EACbUZen3HxKv0tQAPmsQDranlb5Y_YLraQvlRkJYvL77wfFkmldw1gEnMXIqx4lE';
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }
      
      if (subscription) {
        await fetch('/api/usuarios/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON ? subscription.toJSON() : subscription
          })
        });
        console.log('Operador de caixa inscrito para push notifications com sucesso!');
      }
    } catch (error) {
      console.warn('Erro ao inscrever operador em Web Push:', error);
    }
  };

  useEffect(() => {
    if (session?.user?.id && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      inscreverPushUsuario(session.user.id);
    }
  }, [session]);

  const solicitarPermissaoPushUsuario = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Seu navegador não oferece suporte para notificações Web Push ou não está sob conexão segura (HTTPS).');
      return;
    }
    setIsSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === 'granted' && session?.user?.id) {
        await inscreverPushUsuario(session.user.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubscribing(false);
    }
  };

  const testarNotificacaoUsuario = async () => {
    if (!session?.user?.id) return;
    setTestLoading(true);
    setTestSuccess(false);
    try {
      const res = await fetch('/api/clientes/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId: session.user.id })
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

  const isMaster = session?.user?.role === 'MASTER';
  const eventoId = isMaster ? (selectedEventoId || session?.user?.eventoId) : session?.user?.eventoId;
  const valorRestante = parseFloat(valorTotal || 0) - pagamentos.reduce((a, p) => a + p.valor, 0);

  const handleCardNumberChange = (val) => {
    const formatted = val.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").slice(0, 19);
    setCardNumber(formatted);
  };

  const handleCardExpiryChange = (val) => {
    const d = val.replace(/\D/g, "");
    if (d.length >= 3) {
      setCardExpiry(d.slice(0, 2) + "/" + d.slice(2, 4));
    } else {
      setCardExpiry(d);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  useEffect(() => {
    if (isMaster) {
      fetch("/api/eventos")
        .then(r => r.json())
        .then(data => {
          if (!data.error) setEventosMaster(data);
        })
        .catch(console.error);
    }
  }, [isMaster]);

  useEffect(() => {
    if (eventoId) {
      fetch(`/api/eventos/${eventoId}`)
        .then(r => r.json())
        .then(data => {
          if (!data.error) {
            setEvento(data);
            let metodos = [];
            if (data.metodosPagamentoJson) {
              const list = JSON.parse(data.metodosPagamentoJson);
              metodos = list.filter(p => p.ativo);
            } else {
              metodos = [
                { id: "pix", label: "Pix", emoji: "🟢", ativo: true },
                { id: "cartao", label: "Cartão", emoji: "💳", ativo: true },
                { id: "dinheiro", label: "Dinheiro", emoji: "💵", ativo: true, troco: true },
              ];
            }
            
            // Restrição Rigorosa de Dinheiro
            const role = session?.user?.role;
            const canAcceptCash = role === 'MASTER' || role === 'TESOURARIA';
            if (!canAcceptCash) {
              metodos = metodos.filter(m => m.id !== 'dinheiro');
            }
            
            setMetodosPagamento(metodos);
          }
        })
        .catch(console.error);
    }
  }, [eventoId]);

  useEffect(() => {
    if (codigoCartao && typeof window !== "undefined") {
      const url = `${window.location.origin}/cartao/${codigoCartao}`;
      QRCode.toDataURL(url, { width: 256, margin: 1 }).then(setQrCodeDataUrl);
    }
  }, [codigoCartao]);

  // Polling para confirmação automática do Pix
  useEffect(() => {
    let intervalId;
    if (pixGerado && pixTxid && eventoId) {
      const checkStatus = async () => {
        try {
          const res = await fetch(`/api/pagamentos/status/${pixTxid}?eventoId=${eventoId}`);
          const data = await res.json();
          if (data.status === "CONFIRMED" || data.status === "RECEIVED") {
            setPagamentos(prev => {
              const jaAdicionado = prev.some(p => p.metodo === "pix" && p.gatewayId === pixTxid);
              if (jaAdicionado) return prev;
              return [...prev, { metodo: "pix", valor: valorRestante, gatewayId: pixTxid }];
            });
            setPixGerado(false);
            setMetodoAtual("");
            setErro("✨ Pix pago com sucesso!");
            setTimeout(() => setErro(prev => prev.startsWith("✨") ? "" : prev), 4000);
          }
        } catch (e) {
          console.error("Erro ao verificar status do Pix:", e);
        }
      };

      checkStatus();
      intervalId = setInterval(checkStatus, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pixGerado, pixTxid, eventoId, valorRestante]);

  async function buscarCliente() {
    if (!eventoId) {
      setErro("Nenhum evento ativo selecionado. Selecione o evento para buscas.");
      return;
    }
    setBuscando(true);
    setResultadosBusca([]);
    setCartaoEncontrado(null);
    setErro("");
    try {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(termoBusca)}&eventoId=${eventoId}`);
      const data = await res.json();
      setResultadosBusca(data);
    } catch { setErro("Erro ao buscar cliente"); }
    finally { setBuscando(false); }
  }

  async function finalizarCadastro() {
    if (!nome.trim()) { setErro("Por favor informe o nome do cliente."); return; }
    if (!eventoId) { setErro("Erro: Nenhum evento vinculado. Selecione o evento no topo."); return; }
    if (valorRestante > 0.01) { setErro("Erro: Valor restante a pagar pendente."); return; }
    
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, cpf: cpf.replace(/\D/g,""), celular: celular.replace(/\D/g,""), eventoId, valorRecarga: parseFloat(valorTotal), pagamentos }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Erro ao cadastrar"); return; }
      setCodigoCartao(data.codigo);
      setEtapa("cupom");
    } catch { setErro("Erro de conexão"); }
    finally { setCarregando(false); }
  }

  async function fazerRecarga() {
    if (!cartaoEncontrado) { setErro("Selecione o cartão para recarga."); return; }
    if (!eventoId) { setErro("Nenhum evento ativo."); return; }
    if (valorRestante > 0.01) { setErro("Aguardando confirmação de pagamento."); return; }

    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: cartaoEncontrado.cliente.nome,
          cpf: cartaoEncontrado.cliente.cpf,
          eventoId,
          valorRecarga: parseFloat(valorTotal),
          pagamentos,
          cartaoExistente: cartaoEncontrado.codigo,
        }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 409) { setErro(data.error || "Erro"); return; }
      setCodigoCartao(cartaoEncontrado.codigo);
      setEtapa("cupom");
    } catch { setErro("Erro de conexão"); }
    finally { setCarregando(false); }
  }

  function adicionarPagamento() {
    if (!metodoAtual) return;
    const metodoInfo = metodosPagamento.find(m => m.id === metodoAtual);
    const admiteTroco = metodoInfo?.troco || false;
    let vlr = Math.min(valorRestante, admiteTroco ? parseFloat(valorRecebido || 0) : valorRestante);
    if (admiteTroco && parseFloat(valorRecebido || 0) <= 0) return;
    setPagamentos([...pagamentos, { metodo: metodoAtual, valor: vlr, recebido: admiteTroco ? parseFloat(valorRecebido) : null }]);
    setMetodoAtual(""); setValorRecebido("");
  }

  function voltarParaValor() {
    setPagamentos([]);
    setMetodoAtual("");
    setValorRecebido("");
    setPixQrCode("");
    setPixCopiaCola("");
    setPixTxid("");
    setPixGerado(false);
    setCardName("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    setUsarCheckoutOffline(false);
    setSavedCardToken("");
    setSavedCardBrand("");
    setSavedCardLastDigits("");
    setUsarCartaoSalvo(false);
    setErro("");
    setEtapa("valor");
  }

  function novoAtendimento() {
    setNome(""); setCpf(""); setCelular(""); setValorTotal(""); setPagamentos([]);
    setMetodoAtual(""); setValorRecebido(""); setCodigoCartao(""); setQrCodeDataUrl("");
    setTermoBusca(""); setResultadosBusca([]); setCartaoEncontrado(null); setErro("");
    setPixQrCode(""); setPixCopiaCola(""); setPixTxid(""); setPixGerado(false);
    setCardName(""); setCardNumber(""); setCardExpiry(""); setCardCvc("");
    setUsarCheckoutOffline(false);
    setSavedCardToken("");
    setSavedCardBrand("");
    setSavedCardLastDigits("");
    setUsarCartaoSalvo(false);
    setCarregando(false);
    setGerandoPix(false);
    setProcessandoCartao(false);
    setEtapa("inicio");
  }

  async function iniciarPixDinamico() {
    setGerandoPix(true);
    setErro("");
    try {
      const res = await fetch("/api/pagamentos/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor: valorRestante,
          clienteNome: nome || cartaoEncontrado?.cliente?.nome || "Cliente Consumidor",
          cpf: (cpf || "").replace(/\D/g, ""),
          eventoId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Erro ao gerar Pix");
      } else {
        setPixQrCode(data.qrCodeUrl);
        setPixCopiaCola(data.pixPayload);
        setPixTxid(data.txid);
        setPixGerado(true);
      }
    } catch (err) {
      console.error("Erro ao gerar Pix:", err);
      setErro(`Erro de rede ao gerar Pix: ${err.message}`);
    } finally {
      setGerandoPix(false);
    }
  }

  async function processarCartaoAsaas() {
    const rawCpf = cpf ? cpf.replace(/\D/g, "") : "";
    if (!rawCpf || rawCpf.length !== 11) {
      setErro("CPF é obrigatório para transações de cartão online (Asaas). Preencha-o abaixo.");
      return;
    }
    if (!usarCartaoSalvo) {
      if (!cardName.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCvc.trim()) {
        setErro("Preencha todos os campos do cartão.");
        return;
      }
    }
    setProcessandoCartao(true);
    setErro("");
    try {
      const res = await fetch("/api/pagamentos/cartao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor: valorRestante,
          clienteNome: nome || cartaoEncontrado?.cliente?.nome || "Consumidor La More",
          cpf: rawCpf,
          eventoId,
          cardName: usarCartaoSalvo ? undefined : cardName,
          cardNumber: usarCartaoSalvo ? undefined : cardNumber,
          cardExpiry: usarCartaoSalvo ? undefined : cardExpiry,
          cardCvc: usarCartaoSalvo ? undefined : cardCvc,
          useSavedCard: usarCartaoSalvo,
          cartaoCodigo: cartaoEncontrado?.codigo || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Erro ao processar pagamento com cartão.");
      } else {
        setPagamentos([...pagamentos, { metodo: "cartao", valor: valorRestante, gatewayId: data.txid }]);
        setMetodoAtual("");
        setCardName("");
        setCardNumber("");
        setCardExpiry("");
        setCardCvc("");
        setUsarCheckoutOffline(false);
      }
    } catch {
      setErro("Erro de conexão ao processar cartão.");
    } finally {
      setProcessandoCartao(false);
    }
  }

  async function handleCpfChange(val) {
    const formatted = formatarCpf(val);
    setCpf(formatted);

    const rawCpf = val.replace(/\D/g, "");
    if (rawCpf.length === 11) {
      try {
        const res = await fetch(`/api/clientes/consultar?cpf=${rawCpf}`);
        const data = await res.json();
        if (data.found) {
          setNome(data.cliente.nome);
          if (data.cliente.celular) {
            setCelular(formatarTel(data.cliente.celular));
          }
          if (data.cliente.creditCardToken) {
            setSavedCardToken(data.cliente.creditCardToken);
            setSavedCardBrand(data.cliente.creditCardBrand || "");
            setSavedCardLastDigits(data.cliente.creditCardLastDigits || "");
            setUsarCartaoSalvo(true);
          } else {
            setSavedCardToken("");
            setSavedCardBrand("");
            setSavedCardLastDigits("");
            setUsarCartaoSalvo(false);
          }
          setErro("✨ Cliente localizado! Dados preenchidos automaticamente.");
          setTimeout(() => setErro(prev => prev.startsWith("✨") ? "" : prev), 4000);
        }
      } catch (e) {
        console.error("Erro ao buscar CPF", e);
      }
    }
  }

  if (status === "loading") return <div className="min-h-screen bg-[#1D3461] flex items-center justify-center"><p className="text-white text-2xl">Carregando...</p></div>;

  // ── QR Code ──
  if (etapa === "qrcode") return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-blue-200 text-xl font-bold mb-1">Cartão emitido para</p>
        <h2 className="text-4xl font-black text-white mb-2">{nome || cartaoEncontrado?.cliente?.nome}</h2>
        <p className="text-green-400 text-5xl font-black mb-8">R$ {parseFloat(valorTotal).toFixed(2).replace(".",",")}</p>
        <div className="bg-white rounded-3xl p-8 mb-6 shadow-2xl inline-block">
          {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR Code" className="w-56 h-56 mx-auto" /> : <div className="w-56 h-56 flex items-center justify-center text-8xl">📱</div>}
          <p className="text-gray-500 font-bold mt-3 text-lg">QR Code do Cartão</p>
          <p className="text-gray-900 font-black text-xl">{codigoCartao}</p>
        </div>
        <p className="text-blue-200 text-lg font-semibold mb-6">Peça para o cliente fotografar</p>
        <div className="bg-white/10 rounded-2xl p-4 mb-6 text-sm text-blue-200 leading-normal">
          💡 <strong>Notificações no Celular:</strong> Oriente o cliente a escanear o QR Code e clicar no botão <strong>Ativar Notificações</strong> no celular para receber avisos de saldo na tela.
        </div>
        <div className="space-y-3">
          <a href={`/cartao/${codigoCartao}`} target="_blank" rel="noopener noreferrer" className="w-full bg-teal-500 text-white font-black text-xl py-5 rounded-3xl shadow-xl flex items-center justify-center gap-2" style={{minHeight:"52px"}}>🔗 Visualizar Cartão Virtual</a>
          <button onClick={novoAtendimento} className="w-full bg-white text-[#1D3461] font-black text-xl py-5 rounded-3xl shadow-xl" style={{minHeight:"52px"}}>✅ Novo Atendimento</button>
        </div>
      </div>
    </div>
  );

  // ── Cupom ──
  if (etapa === "cupom") {
    const dataHora = new Date().toLocaleString("pt-BR");
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4">
        <div className="bg-white p-8 rounded-none w-full max-w-[350px] shadow-lg font-mono text-sm leading-tight border-t-8 border-[#1D3461] text-gray-900" id="cupom-print">
          <div className="text-center mb-4">
            <h1 className="font-black text-xl">LA MORE EVENTOS</h1>
            <p>RECIBO DE RECARGA — NÃO FISCAL</p>
            <p className="text-xs mt-1">{dataHora}</p>
          </div>
          <p>---------------------------------</p>
          <p>CLIENTE: {(nome || cartaoEncontrado?.cliente?.nome || "").toUpperCase()}</p>
          {cpf && <p>CPF: {cpf}</p>}
          <p>---------------------------------</p>
          <div className="flex justify-between font-black text-lg"><span>RECARGA CARTÃO</span><span>{parseFloat(valorTotal).toFixed(2).replace(".",",")}</span></div>
          <p>---------------------------------</p>
          <div className="flex justify-between font-black text-lg mb-2"><span>TOTAL R$</span><span>{parseFloat(valorTotal).toFixed(2).replace(".",",")}</span></div>
          <p className="font-bold">PAGAMENTO(S):</p>
          {pagamentos.map((p,i) => (
            <div key={i} className="flex justify-between text-xs">
              <span>- {p.metodo.toUpperCase()}</span>
              <span>{p.valor.toFixed(2).replace(".",",")}</span>
            </div>
          ))}
          {pagamentos.filter(p=>p.metodo==="dinheiro"&&p.recebido>p.valor).map((p,i) => (
            <div key={`t${i}`} className="flex justify-between text-xs font-bold mt-1">
              <span>TROCO</span><span>{(p.recebido-p.valor).toFixed(2).replace(".",",")}</span>
            </div>
          ))}
          <div className="text-center mt-4">
            <p>Nº: {codigoCartao}</p>
            {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="QR" className="w-24 h-24 mx-auto mt-2" />}
          </div>
          <p className="text-center text-xs mt-4">Obrigado pela preferência!</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-800 leading-normal w-full max-w-[350px] mb-2 font-sans font-semibold">
          💡 <strong>Notificações no Celular:</strong> Oriente o cliente a escanear o QR Code e clicar no botão <strong>Ativar Notificações</strong> no celular para receber avisos de saldo na tela.
        </div>
        <div className="w-full max-w-[350px] mt-4 space-y-3">
          <a href={`/cartao/${codigoCartao}`} target="_blank" rel="noopener noreferrer" className="w-full bg-teal-600 text-white font-black text-xl py-5 rounded-2xl shadow-xl flex items-center justify-center gap-2" style={{minHeight:"52px"}}>🔗 Visualizar Cartão Virtual</a>
          <button onClick={novoAtendimento} className="w-full bg-white text-[#1D3461] font-black text-xl py-5 rounded-2xl shadow-xl border-2 border-[#1D3461]/10" style={{minHeight:"52px"}}>✅ Novo Atendimento</button>
        </div>
      </div>
    );
  }

  // ── Pagamento ──
  if (etapa === "pagamento") return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col p-6">
      <button onClick={voltarParaValor} className="text-blue-200 text-xl font-bold mb-6">← Voltar</button>
      <h2 className="text-3xl font-black text-white mb-2">Pagamento</h2>
      <div className="bg-white/10 rounded-3xl p-5 mb-5 flex justify-between">
        <div><p className="text-blue-200 text-sm font-bold uppercase">Total</p><p className="text-white text-3xl font-black">R$ {parseFloat(valorTotal).toFixed(2).replace(".",",")}</p></div>
        <div className="text-right"><p className="text-blue-200 text-sm font-bold uppercase">Falta</p><p className={`text-3xl font-black ${valorRestante > 0 ? "text-yellow-400" : "text-green-400"}`}>R$ {Math.max(0, valorRestante).toFixed(2).replace(".",",")}</p></div>
      </div>
      {pagamentos.length > 0 && (
        <div className="mb-4 space-y-2">
          {pagamentos.map((p,i) => (
            <div key={i} className="bg-white rounded-2xl p-4 flex justify-between items-center">
              <span className="font-black text-gray-900 text-lg capitalize">{metodosPagamento.find(m=>m.id===p.metodo)?.emoji || "💳"} {metodosPagamento.find(m=>m.id===p.metodo)?.label || p.metodo}</span>
              <div className="flex items-center gap-3">
                <span className="font-black text-gray-900">R$ {p.valor.toFixed(2).replace(".",",")}</span>
                <button onClick={() => setPagamentos(pagamentos.filter((_,j)=>j!==i))} className="text-red-500 bg-red-50 p-2 rounded-xl">❌</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {valorRestante > 0.01 ? (
        <div className="bg-white rounded-3xl p-6">
          <p className="font-black text-xl text-gray-900 mb-4">Como pagar o restante?</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {metodosPagamento.map(m => (
              <button key={m.id} onClick={() => {setMetodoAtual(m.id); setValorRecebido("");}} className={`py-3 rounded-2xl font-black border-2 flex flex-col items-center ${metodoAtual===m.id?"bg-[#1D3461] text-white border-[#1D3461]":"bg-gray-50 text-gray-700 border-gray-200"}`}>
                <span className="text-3xl mb-1">{m.emoji}</span><span className="text-sm">{m.label}</span>
              </button>
            ))}
          </div>
          {metodoAtual && metodosPagamento.find(m => m.id === metodoAtual)?.troco && (
            <div className="mb-4 p-4 bg-gray-50 rounded-2xl">
              <label className="font-black text-gray-900 block mb-2">Valor recebido (R$)</label>
              <input type="number" value={valorRecebido} onChange={e=>setValorRecebido(e.target.value)} placeholder="0,00" className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-3xl font-black focus:outline-none focus:border-[#1D3461] text-gray-900" />
              {parseFloat(valorRecebido||0) > valorRestante && (
                <div className="mt-3 p-3 bg-green-100 rounded-xl flex justify-between">
                  <span className="text-green-800 font-black">Troco:</span>
                  <span className="text-green-700 font-black text-xl">R$ {(parseFloat(valorRecebido)-valorRestante).toFixed(2).replace(".",",")}</span>
                </div>
              )}
            </div>
          )}

          {metodoAtual === "pix" && !pixGerado && (
            <div className="mb-4 text-center">
              <p className="text-gray-500 font-bold mb-3">
                {evento?.gatewayActive === "ASAAS"
                  ? "Cobrança Pix integrada com Asaas"
                  : evento?.gatewayActive === "PAGBANK"
                  ? "Cobrança Pix integrada com PagBank"
                  : "Cobrança Pix (Simulação)"}
              </p>
              {erro && (
                <div className="bg-red-100 border-2 border-red-200 text-red-700 p-3 rounded-2xl mb-3 font-bold text-sm">
                  ⚠️ {erro}
                </div>
              )}
              <button
                type="button"
                onClick={iniciarPixDinamico}
                disabled={gerandoPix}
                className="w-full bg-teal-500 text-white font-black text-lg py-4 rounded-2xl hover:bg-teal-600 transition-colors"
                style={{minHeight: "52px"}}
              >
                {gerandoPix ? "Gerando Pix..." : `⚡ Gerar QR Code Pix ${evento?.gatewayActive === "ASAAS" ? "Asaas" : evento?.gatewayActive === "PAGBANK" ? "PagBank" : "Simulado"}`}
              </button>
            </div>
          )}

          {metodoAtual === "pix" && pixGerado && (
            <div className="mb-4 p-5 bg-gray-50 rounded-3xl text-center border-2 border-dashed border-teal-200">
              <img 
                src={pixQrCode} 
                alt={`QR Code Pix ${evento?.gatewayActive === "ASAAS" ? "Asaas" : evento?.gatewayActive === "PAGBANK" ? "PagBank" : "Simulado"}`} 
                className="w-48 h-48 mx-auto mb-3 border border-gray-200 rounded-xl" 
              />
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">QR Code de Recarga Pix</p>
              
              <div className="mb-4">
                <input
                  type="text"
                  readOnly
                  value={pixCopiaCola}
                  onClick={(e) => {
                    e.target.select();
                    navigator.clipboard.writeText(pixCopiaCola);
                    alert("Copia e Cola copiado!");
                  }}
                  className="w-full bg-gray-100 text-gray-600 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-center cursor-pointer overflow-ellipsis"
                  title="Clique para copiar"
                />
                <p className="text-gray-400 text-[10px] mt-1">Clique acima para copiar o código Copia e Cola</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  adicionarPagamento();
                  setPixGerado(false);
                }}
                className="w-full bg-green-500 text-white font-black text-lg py-4 rounded-2xl hover:bg-green-600 transition-colors"
                style={{minHeight: "52px"}}
              >
                ✅ Confirmar Recebimento do Pix
              </button>
            </div>
          )}

          {metodoAtual === "cartao" && !pixGerado && (
            <div className="mb-4 text-center">
              <p className="text-gray-500 font-bold mb-3">Cobrança Digital Mercado Pago (Cartão no Celular)</p>
              {erro && <p className="text-red-500 text-sm font-bold mb-3">{erro}</p>}
              <button
                type="button"
                onClick={iniciarCheckoutOnline}
                disabled={processandoCartao}
                className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-2xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                style={{minHeight: "52px"}}
              >
                {processandoCartao ? "Gerando Link..." : "⚡ Gerar Link de Cartão"}
              </button>
            </div>
          )}

          {metodoAtual && metodoAtual !== "pix" && metodoAtual !== "cartao" && (
            <div className="mb-4 text-center">
              <button 
                onClick={adicionarPagamento} 
                disabled={metodosPagamento.find(m => m.id === metodoAtual)?.troco && parseFloat(valorRecebido||0)<=0}
                className="w-full bg-blue-600 text-white font-black text-xl py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
                style={{minHeight: "52px"}}
              >
                {metodoAtual === "dinheiro" ? "💰 Receber Dinheiro" : "✅ Confirmar Pagamento"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-auto bg-green-500 rounded-3xl p-6 text-center text-white">
          <span className="text-6xl block mb-2">✅</span>
          <h3 className="text-3xl font-black mb-4">Pagamento Completo!</h3>
          {erro && <p className="bg-red-600 text-white p-3 rounded-xl mb-4 font-bold border border-red-500">{erro}</p>}
          <button onClick={cartaoEncontrado ? fazerRecarga : finalizarCadastro} disabled={carregando} className="w-full bg-white text-green-700 font-black text-2xl py-5 rounded-2xl disabled:opacity-50">
            {carregando ? "Salvando..." : "✅ Confirmar e Emitir Cartão"}
          </button>
        </div>
      )}
    </div>
  );

  // ── Valor ──
  if (etapa === "valor") return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col p-6">
      <button onClick={() => { setValorTotal(""); setEtapa(cartaoEncontrado ? "busca" : "novo_cliente"); }} className="text-blue-200 text-xl font-bold mb-8">← Voltar</button>
      <h2 className="text-3xl font-black text-white mb-2">Valor da Recarga</h2>
      <p className="text-blue-200 text-xl font-semibold mb-6">Cliente: <span className="text-white font-black">{nome || cartaoEncontrado?.cliente?.nome}</span></p>
      <div className="bg-white/10 rounded-3xl p-6 mb-6">
        <p className="text-blue-200 font-bold mb-2">Valor (R$)</p>
        <input type="number" value={valorTotal} onChange={e=>setValorTotal(e.target.value)} placeholder="0,00" className="w-full bg-transparent text-white text-5xl font-black focus:outline-none placeholder-white/30 text-center" />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {["30","50","80","100","150","200"].map(v => (
          <button key={v} onClick={() => setValorTotal(v)} className={`py-4 rounded-2xl font-black text-xl ${valorTotal===v?"bg-white text-[#1D3461]":"bg-white/10 text-white"}`} style={{minHeight:"52px"}}>R$ {v}</button>
        ))}
      </div>
      <button onClick={() => {
        setPagamentos([]);
        setMetodoAtual("");
        setValorRecebido("");
        setPixQrCode("");
        setPixCopiaCola("");
        setPixTxid("");
        setPixGerado(false);
        setCardName("");
        setCardNumber("");
        setCardExpiry("");
        setCardCvc("");
        setUsarCheckoutOffline(false);
        setSavedCardToken("");
        setSavedCardBrand("");
        setSavedCardLastDigits("");
        setUsarCartaoSalvo(false);
        setErro("");
        setEtapa("pagamento");
      }} disabled={!valorTotal||parseFloat(valorTotal)<=0} className="w-full bg-green-500 text-white font-black text-2xl py-6 rounded-3xl shadow-2xl disabled:opacity-40 mt-auto" style={{minHeight:"72px"}}>Avançar p/ Pagamento →</button>
    </div>
  );

  // ── Novo Cliente ──
  if (etapa === "novo_cliente") return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col p-6">
      <button onClick={() => setEtapa("inicio")} className="text-blue-200 text-xl font-bold mb-8">← Voltar</button>
      <h2 className="text-3xl font-black text-white mb-8">Novo Cliente</h2>
      {erro && <p className="bg-red-600 text-white p-3 rounded-xl mb-4 font-bold border border-red-500">{erro}</p>}
      <div className="space-y-5 flex-1">
        <div>
          <label className="text-white font-black text-xl mb-2 block">Nome completo <span className="text-red-400">*</span></label>
          <input type="text" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex: João Silva" className="w-full bg-white/10 border-2 border-white/20 text-white placeholder-blue-300 rounded-2xl px-5 py-4 text-xl font-semibold focus:outline-none focus:border-white" />
        </div>
        <div>
          <label className="text-white font-black text-xl mb-2 block">CPF <span className="text-blue-300 text-base font-semibold">(opcional)</span></label>
          <input type="text" value={cpf} onChange={e=>handleCpfChange(e.target.value)} placeholder="000.000.000-00" className="w-full bg-white/10 border-2 border-white/20 text-white placeholder-blue-300 rounded-2xl px-5 py-4 text-xl font-semibold focus:outline-none focus:border-white" />
        </div>
        <div>
          <label className="text-white font-black text-xl mb-2 block">Celular <span className="text-blue-300 text-base font-semibold">(opcional)</span></label>
          <input type="tel" value={celular} onChange={e=>setCelular(formatarTel(e.target.value))} placeholder="(11) 99999-9999" className="w-full bg-white/10 border-2 border-white/20 text-white placeholder-blue-300 rounded-2xl px-5 py-4 text-xl font-semibold focus:outline-none focus:border-white" />
        </div>
      </div>
      <button onClick={() => { setCartaoEncontrado(null); setEtapa("valor"); }} disabled={!nome.trim()} className="w-full bg-white text-[#1D3461] font-black text-2xl py-6 rounded-3xl shadow-2xl disabled:opacity-40 mt-8" style={{minHeight:"72px"}}>Avançar →</button>
    </div>
  );

  // ── Busca de Cliente ──
  if (etapa === "busca") return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col p-6">
      <button onClick={() => setEtapa("inicio")} className="text-blue-200 text-xl font-bold mb-8">← Voltar</button>
      <h2 className="text-3xl font-black text-white mb-2">Buscar Cliente</h2>
      <p className="text-blue-200 text-lg mb-6">Para recarga ou reemissão de QR</p>
      {erro && <p className="bg-red-600 text-white p-3 rounded-xl mb-4 font-bold border border-red-500">{erro}</p>}
      <div className="flex gap-3 mb-6">
        <input value={termoBusca} onChange={e=>setTermoBusca(e.target.value)} onKeyDown={e=>e.key==="Enter"&&buscarCliente()} placeholder="Nome, CPF ou Celular..." className="flex-1 bg-white/10 border-2 border-white/20 text-white placeholder-blue-300 rounded-2xl px-5 py-4 text-xl font-semibold focus:outline-none focus:border-white" />
        <button onClick={buscarCliente} disabled={buscando} className="bg-white text-[#1D3461] font-black px-6 py-4 rounded-2xl">🔍</button>
      </div>
      <div className="space-y-3">
        {buscando && <p className="text-blue-200 text-center">Buscando...</p>}
        {resultadosBusca.map(c => (
          <div key={c.id} className="bg-white rounded-3xl p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-xl font-black text-gray-900">{c.cliente.nome}</h3>
                {c.cliente.cpf && <p className="text-gray-400 text-sm">{c.cliente.cpf}</p>}
              </div>
              <p className="text-green-600 font-black text-2xl">R$ {c.saldo.toFixed(2).replace(".",",")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => {
                setCartaoEncontrado(c);
                setNome(c.cliente.nome);
                setCpf(c.cliente.cpf || "");
                if (c.cliente.creditCardToken) {
                  setSavedCardToken(c.cliente.creditCardToken);
                  setSavedCardBrand(c.cliente.creditCardBrand || "");
                  setSavedCardLastDigits(c.cliente.creditCardLastDigits || "");
                  setUsarCartaoSalvo(true);
                } else {
                  setSavedCardToken("");
                  setSavedCardBrand("");
                  setSavedCardLastDigits("");
                  setUsarCartaoSalvo(false);
                }
                setPagamentos([]);
                setEtapa("valor");
              }} className="bg-[#1D3461] text-white font-black py-3 rounded-2xl" style={{minHeight:"48px"}}>💳 Recarregar</button>
              <button onClick={() => { setCartaoEncontrado(c); setCodigoCartao(c.codigo); setEtapa("qrcode"); }} className="bg-gray-100 text-gray-900 font-black py-3 rounded-2xl" style={{minHeight:"48px"}}>📱 Ver QR</button>
            </div>
          </div>
        ))}
        {!buscando && resultadosBusca.length === 0 && termoBusca && <p className="text-blue-300 text-center">Nenhum cliente encontrado</p>}
      </div>
    </div>
  );

  // ── Início ──
  return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col p-6">
      <div className="flex items-center justify-between mb-10 pt-4">
        <div>
          <p className="text-blue-300 text-base font-bold uppercase tracking-widest">Caixa de Entrada</p>
          <h1 className="text-3xl font-black text-white">{evento?.nome || "POS La More"}</h1>
        </div>
        <button 
          onClick={() => {
            router.push("/acessos");
          }} 
          className="text-blue-300 font-bold text-lg cursor-pointer"
        >
          Voltar ao Portal
        </button>
      </div>

      {/* NOTIFICATION TOGGLE / CONTROLS FOR CASHIER */}
      <div className="bg-white/5 p-4 rounded-2xl mb-6 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-left relative">
        <div className="flex-1">
          <p className="text-white font-bold text-sm flex items-center gap-1.5">
            <span>🔔</span> Notificações no Caixa
          </p>
          <p className="text-[11px] text-blue-200/60 mt-0.5 leading-normal">
            Receba alertas imediatos na tela deste dispositivo quando houver novas recargas online ou consumos de bar.
          </p>
        </div>
        
        {pushPermission === 'granted' ? (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              ● Ativas
            </span>
            <button
              onClick={testarNotificacaoUsuario}
              disabled={testLoading}
              className="bg-teal-500 hover:bg-teal-600 text-white font-black text-xs px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              {testLoading ? "Testando..." : "Testar"}
            </button>
            {testSuccess && (
              <span className="absolute bottom-[-16px] right-4 text-[9px] text-emerald-400 font-bold animate-pulse">
                Notificação enviada!
              </span>
            )}
          </div>
        ) : pushPermission === 'denied' ? (
          <span className="text-[11px] text-rose-400 font-bold bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 text-center sm:text-right w-full sm:w-auto">
            🚫 Bloqueadas no Navegador
          </span>
        ) : (
          <button
            onClick={solicitarPermissaoPushUsuario}
            disabled={isSubscribing}
            className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow text-center cursor-pointer"
          >
            {isSubscribing ? "Ativando..." : "Ativar Notificações"}
          </button>
        )}
      </div>

      {/* Master Event Selector */}
      {isMaster && (
        <div className="bg-white/10 p-4 rounded-2xl mb-6 border border-white/10 text-center">
          <label className="block text-blue-200 text-xs font-bold uppercase tracking-widest mb-1.5">Operando como MASTER. Selecione o Evento para Testes:</label>
          <select
            value={selectedEventoId}
            onChange={(e) => setSelectedEventoId(e.target.value)}
            className="w-full max-w-xs bg-white text-gray-900 font-bold px-3 py-2 rounded-xl outline-none"
          >
            <option value="">Selecione o Evento...</option>
            {eventosMaster.map(evt => (
              <option key={evt.id} value={evt.id}>{evt.nome}</option>
            ))}
          </select>
        </div>
      )}

      {/* Warning banner for regular operators without an event */}
      {!eventoId && !isMaster && (
        <div className="bg-red-500/20 border-2 border-red-400/40 text-red-200 p-4 rounded-2xl mb-6 font-bold text-center">
          ⚠️ Alerta: Este operador não possui nenhum evento vinculado. Vincule-o a um evento no painel Master para realizar transações.
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center space-y-4">
        <button onClick={() => { novoAtendimento(); setEtapa("novo_cliente"); }} disabled={!eventoId} className="w-full bg-white text-[#1D3461] font-black text-2xl py-8 rounded-3xl shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50" style={{minHeight:"80px"}}>
          <span className="text-4xl">👤</span> Novo Cliente
        </button>
        <button onClick={() => { novoAtendimento(); setEtapa("busca"); }} disabled={!eventoId} className="w-full bg-white/10 text-white border-2 border-white/20 font-black text-2xl py-8 rounded-3xl flex items-center justify-center gap-4 disabled:opacity-50" style={{minHeight:"80px"}}>
          <span className="text-4xl">🔍</span> Buscar Cliente
        </button>
      </div>
      <p className="text-blue-300 text-center text-base font-semibold mt-8">La More Eventos • Caixa</p>
    </div>
  );
}
