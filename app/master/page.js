"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

const menuItens = [
  { href: "/master/eventos", emoji: "🎪", titulo: "Eventos", desc: "Criar e gerenciar todos os eventos da plataforma" },
  { href: "/master/usuarios", emoji: "👥", titulo: "Usuários e Operadores", desc: "Organizadores, caixas e operadores de bar" },
  { href: "/master/financeiro", emoji: "💰", titulo: "Financeiro & Taxas", desc: "Taxas por evento, royalties e repasses (privado)" },
  { href: "/master/relatorios", emoji: "📊", titulo: "Relatórios Globais", desc: "Visão completa de todos os eventos" },
  { href: "/master/auditoria", emoji: "🔍", titulo: "Auditoria", desc: "Log de todas as movimentações do sistema" },
];

export default function MasterDashboard() {
  const [metrics, setMetrics] = useState({
    eventosAtivos: 0,
    cartoesEmitidos: 0,
    totalRecarregado: 0,
    taxaLaMore: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/master/dashboard')
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setMetrics(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statsCards = [
    { 
      label: "Eventos Ativos", 
      valor: metrics.eventosAtivos.toString(), 
      isCurrency: false,
      emoji: "🎪", 
      bg: "bg-blue-50/80 border-blue-100", 
      text: "text-blue-700",
      badge: "bg-blue-100/70"
    },
    { 
      label: "Cartões Emitidos", 
      valor: metrics.cartoesEmitidos.toString(), 
      isCurrency: false,
      emoji: "💳", 
      bg: "bg-emerald-50/80 border-emerald-100", 
      text: "text-emerald-700",
      badge: "bg-emerald-100/70"
    },
    { 
      label: "Total Recarregado", 
      valor: metrics.totalRecarregado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 
      isCurrency: true,
      emoji: "💰", 
      bg: "bg-amber-50/80 border-amber-100", 
      text: "text-amber-700",
      badge: "bg-amber-100/70"
    },
    { 
      label: "Taxa La More", 
      valor: metrics.taxaLaMore.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 
      isCurrency: true,
      emoji: "👑", 
      bg: "bg-purple-50/80 border-purple-100", 
      text: "text-purple-700",
      badge: "bg-purple-100/70"
    },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <h2 className="text-4xl font-black text-[#1D3461] mb-1">Dashboard</h2>
      <p className="text-gray-500 text-lg font-semibold mb-8">Visão geral consolidada da plataforma</p>

      {/* Cards de Métricas com Design Responsivo e Sem Quebras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statsCards.map((card) => (
          <div 
            key={card.label} 
            className={`${card.bg} ${card.text} rounded-3xl p-5 border-2 flex flex-col justify-between min-h-[135px] shadow-sm transition-all hover:shadow-md`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs uppercase font-bold tracking-wider opacity-80">{card.label}</span>
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0 ${card.badge}`}>
                {card.emoji}
              </span>
            </div>
            
            <div className="mt-auto">
              {loading ? (
                <div className="h-8 w-24 bg-current opacity-10 rounded animate-pulse"></div>
              ) : (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  {card.isCurrency && (
                    <span className="text-sm font-black opacity-70">R$</span>
                  )}
                  <span className="font-black text-2xl xl:text-[26px] tracking-tight leading-none break-all">
                    {card.valor}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>


      {/* Diagnóstico & Teste de SMS / Twilio */}
      <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 shadow-sm mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📱</span>
              <h3 className="text-xl font-black text-[#1D3461]">Diagnóstico & Teste de Disparo de SMS</h3>
            </div>
            <p className="text-gray-500 text-xs sm:text-sm font-medium mt-0.5">
              Envio automático de link do cartão via Twilio na ativação do cliente.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-50 text-[#1D3461] border border-blue-200 shrink-0 self-start sm:self-auto">
            Configuração de Produção
          </span>
        </div>

        <DiagnosticoSmsBox />
      </div>

      {/* Atalhos */}
      <h3 className="text-2xl font-black text-[#1D3461] mb-4">Acesso Rápido</h3>
      <div className="grid grid-cols-1 gap-4">
        {menuItens.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-5 bg-white rounded-3xl p-5 border-2 border-gray-100 hover:border-[#1D3461] hover:shadow-lg transition-all group"
          >
            <span className="text-4xl">{item.emoji}</span>
            <div>
              <h4 className="font-black text-xl text-gray-900 group-hover:text-[#1D3461]">{item.titulo}</h4>
              <p className="text-gray-500 font-medium">{item.desc}</p>
            </div>
            <span className="ml-auto text-gray-300 group-hover:text-[#1D3461] text-2xl transition-transform group-hover:translate-x-1">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}


function DiagnosticoSmsBox() {
  const [smsStatus, setSmsStatus] = useState(null);
  const [carregandoStatus, setCarregandoStatus] = useState(true);
  const [numeroTeste, setNumeroTeste] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [respostaTeste, setRespostaTeste] = useState(null);

  useEffect(() => {
    fetch('/api/admin/test-sms')
      .then((r) => r.json())
      .then((data) => setSmsStatus(data))
      .catch(console.error)
      .finally(() => setCarregandoStatus(false));
  }, []);

  const handleTestarSms = async (e) => {
    e.preventDefault();
    if (!numeroTeste.trim()) {
      alert('Digite o seu número de celular com DDD (ex: 61999999999)');
      return;
    }
    setEnviando(true);
    setRespostaTeste(null);
    try {
      const res = await fetch('/api/admin/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular: numeroTeste }),
      });
      const data = await res.json();
      setRespostaTeste(data);
    } catch (err) {
      setRespostaTeste({ success: false, error: err.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      {carregandoStatus ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 font-semibold py-2">
          <div className="w-4 h-4 border-2 border-[#1D3461] border-t-transparent rounded-full animate-spin"></div>
          Verificando credenciais do servidor...
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status do Provedor:</span>
            {smsStatus?.twilio?.configured ? (
              <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-black flex items-center gap-1">
                <span>🟢</span> Twilio Conectada {smsStatus.twilio.phoneNumber && `(${smsStatus.twilio.phoneNumber})`}
              </span>
            ) : smsStatus?.activeProvider === 'AWS_SNS' ? (
              <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-black">
                🟢 AWS SNS Ativo
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-black flex items-center gap-1">
                <span>⚪</span> Modo Simulado (Credenciais da Twilio não detectadas no Railway)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Formulário de Teste */}
      <form onSubmit={handleTestarSms} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          type="text"
          value={numeroTeste}
          onChange={(e) => setNumeroTeste(e.target.value)}
          placeholder="Digite seu celular com DDD (ex: 61999999999)"
          className="flex-1 bg-gray-50 border-2 border-gray-200 focus:border-[#1D3461] rounded-xl px-4 py-3 text-sm font-bold text-[#1D3461] outline-none"
        />
        <button
          type="submit"
          disabled={enviando}
          className="bg-[#1D3461] hover:bg-[#112244] text-white font-black text-sm px-6 py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          {enviando ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Disparando SMS...
            </>
          ) : (
            <>
              <span>📤</span> Enviar SMS de Teste
            </>
          )}
        </button>
      </form>

      {/* Feedback do Teste */}
      {respostaTeste && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold leading-relaxed animate-in fade-in ${
            respostaTeste.success && !respostaTeste.simulated
              ? 'bg-green-50 border-green-200 text-green-800'
              : respostaTeste.simulated
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {respostaTeste.success && !respostaTeste.simulated ? (
            <p>
              🎉 <strong>SMS enviado com sucesso via Twilio!</strong> O link do cartão teste foi despachado para a operadora. (Message ID: {respostaTeste.messageId || 'OK'})
            </p>
          ) : respostaTeste.simulated ? (
            <div>
              <p className="font-black text-sm mb-1">ℹ️ SMS Simulado com sucesso nos logs do servidor!</p>
              <p>
                O sistema funcionou normalmente, mas para o SMS tocar no chip do celular, as 3 variáveis da Twilio (<code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> e <code>TWILIO_PHONE_NUMBER</code>) precisam estar inseridas no painel do <strong>Railway (Variables)</strong>.
              </p>
            </div>
          ) : (
            <div>
              <p className="font-black text-sm mb-1">⚠️ Erro retornado pela Twilio:</p>
              <p>{respostaTeste.error || 'Falha ao autenticar ou enviar via Twilio.'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
