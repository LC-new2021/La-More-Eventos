"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function OrgDashboard() {
  const { data: session } = useSession();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [eventoId, setEventoId] = useState(null);
  
  const [mostrarQrModal, setMostrarQrModal] = useState(false);

  useEffect(() => {
    if (session) {
      if (session.user.role === 'MASTER') {
        const stored = localStorage.getItem("activeEventoId");
        if (stored) {
          setEventoId(stored);
        } else {
          fetch("/api/eventos")
            .then((res) => res.json())
            .then((data) => {
              if (data && data.length > 0) {
                localStorage.setItem("activeEventoId", data[0].id);
                setEventoId(data[0].id);
              }
            });
        }
      } else {
        setEventoId(session.user.eventoId);
      }
    }
  }, [session]);

  useEffect(() => {
    if (eventoId) {
      carregarDashboard();
      const intervalo = setInterval(carregarDashboard, 30000); // atualiza a cada 30s
      return () => clearInterval(intervalo);
    }
  }, [eventoId]);

  async function carregarDashboard() {
    if (!eventoId) return;
    try {
      const res = await fetch(`/api/org/dashboard?eventoId=${eventoId}`);
      const data = await res.json();
      if (res.ok) setDados(data);
    } catch {}
    finally { setCarregando(false); }
  }

  const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtHora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  const [sincronizando, setSincronizando] = useState(false);
  const [msgSincronizacao, setMsgSincronizacao] = useState(null);

  async function sincronizarBilheteria() {
    if (!eventoId) return;
    setSincronizando(true);
    setMsgSincronizacao(null);
    try {
      const res = await fetch('/api/integracao/bilheteria/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventoId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsgSincronizacao({
          tipo: 'sucesso',
          texto: `✔ ${data.novosImportados} novo(s) cartão(ões) importado(s). ${data.jaSincronizados} já estavam sincronizados.`
        });
        carregarDashboard();
      } else {
        setMsgSincronizacao({ tipo: 'erro', texto: data.error || 'Erro ao sincronizar.' });
      }
    } catch (e) {
      setMsgSincronizacao({ tipo: 'erro', texto: 'Falha de conexão com a bilheteria.' });
    } finally {
      setSincronizando(false);
    }
  }

  const metricas = dados ? [
    { label: "Total Recarregado", valor: fmt(dados.totalRecarregado), emoji: "💰", cor: "bg-green-50 text-green-700 border-green-100" },
    { label: "Cartões Ativos", valor: dados.cartoesAtivos, emoji: "💳", cor: "bg-blue-50 text-blue-700 border-blue-100" },
    { label: "Saldo em Aberto", valor: fmt(dados.saldoEmAberto), emoji: "⏳", cor: "bg-yellow-50 text-yellow-700 border-yellow-100" },
    { label: "Pedidos Realizados", valor: dados.totalPedidos, emoji: "🧾", cor: "bg-purple-50 text-purple-700 border-purple-100" },
  ] : [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-4xl font-black text-[#1D3461]">Dashboard</h2>
          <p className="text-gray-500 text-lg font-semibold mt-1">
            {carregando ? "Carregando..." : <span className="text-green-600 font-black">● AO VIVO</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={sincronizarBilheteria}
            disabled={sincronizando}
            className="w-full sm:w-auto bg-[#ff5500] hover:bg-[#e04b00] text-white font-black text-sm px-5 py-3 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {sincronizando ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Sincronizando...
              </>
            ) : (
              <>
                🔄 Sincronizar Vendas Bilheteria
              </>
            )}
          </button>
          <button 
            onClick={() => setMostrarQrModal(true)}
            className="w-full sm:w-auto justify-center bg-[#1D3461]/10 text-[#1D3461] hover:bg-[#1D3461] hover:text-white font-black text-base px-6 py-3 rounded-2xl transition-all flex items-center gap-2"
          >
            <span>📱</span> Auto-Cadastro
          </button>
          <Link href="/org/relatorios" className="w-full sm:w-auto justify-center bg-gray-100 text-gray-700 font-black text-base px-6 py-3 rounded-2xl hover:bg-gray-200 transition-all flex items-center gap-2">
            <span>📊</span> Exportar
          </Link>
        </div>
      </div>

      {msgSincronizacao && (
        <div className={`mb-6 p-4 rounded-2xl text-sm font-bold animate-in fade-in duration-200 flex items-center justify-between ${
          msgSincronizacao.tipo === 'sucesso' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <span>{msgSincronizacao.texto}</span>
          <button type="button" onClick={() => setMsgSincronizacao(null)} className="text-xs font-black underline cursor-pointer ml-3">Fechar</button>
        </div>
      )}

      {dados && (
        <div className={`mb-6 p-4 rounded-2xl border-2 flex items-center justify-between font-black text-sm ${
          (dados.mercadoPagoUserId || dados.gatewayActive === 'MERCADO_PAGO')
            ? 'bg-green-50 border-green-100 text-green-700' 
            : 'bg-yellow-50 border-yellow-100 text-yellow-700'
        }`}>
          <div>
            <span>🔌 Recebimento: </span>
            <span>
              {dados.gatewayActive === 'MERCADO_PAGO'
                ? 'Mercado Pago Ativo (Processamento em tempo real)'
                : dados.mercadoPagoUserId 
                  ? `Split Ativo (Conta Mercado Pago vinculada - ID: ${dados.mercadoPagoUserId})` 
                  : 'Configuração Padrão (Sem split ativo)'}
            </span>
          </div>
          <span className="text-xs opacity-75 font-semibold">
            {dados.gatewayActive === 'MERCADO_PAGO' ? 'VENDAS DIRETAS' : 'VINCULAÇÃO OPCIONAL VIA MASTER'}
          </span>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {carregando ? (
          Array(4).fill(0).map((_,i) => <div key={i} className="bg-gray-100 rounded-3xl p-5 h-32 animate-pulse" />)
        ) : metricas.map((m) => (
          <div key={m.label} className={`${m.cor} border-2 rounded-3xl p-5 flex flex-col justify-between min-h-[135px] shadow-sm hover:shadow-md transition-all`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs uppercase font-bold tracking-wider opacity-80">{m.label}</span>
              <span className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center text-xl shrink-0">
                {m.emoji}
              </span>
            </div>
            <div className="mt-auto">
              <p className="text-2xl xl:text-[26px] font-black tracking-tight leading-none break-all">{m.valor}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Movimentações Recentes */}
        <div className="lg:col-span-2 bg-white rounded-3xl border-2 border-gray-100 p-6">
          <h3 className="text-2xl font-black text-[#1D3461] mb-5">Movimentações Recentes</h3>
          {carregando ? <div className="animate-pulse space-y-3">{Array(5).fill(0).map((_,i) => <div key={i} className="h-12 bg-gray-100 rounded-2xl" />)}</div> : (
            <div className="space-y-3">
              {(dados?.movimentacoes || []).slice(0, 15).map((m) => (
                <div key={m.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl">
                  <span className="text-gray-400 font-bold text-base w-12 shrink-0">{fmtHora(m.criadaEm)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900 text-base truncate">{m.cartao?.cliente?.nome}</p>
                    <p className="text-gray-500 text-sm font-semibold truncate">{m.produto?.nome || (m.tipo === "RECARGA" ? "Recarga" : m.tipo)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-black text-base ${m.tipo === "RECARGA" ? "text-green-600" : "text-red-500"}`}>{m.tipo === "RECARGA" ? "+" : "-"} {fmt(m.valor)}</p>
                    <p className="text-gray-400 text-xs">{m.operador?.nome || ""}</p>
                  </div>
                </div>
              ))}
              {(!dados?.movimentacoes || dados.movimentacoes.length === 0) && <p className="text-gray-400 text-center py-8">Nenhuma movimentação ainda</p>}
            </div>
          )}
        </div>

        {/* Top Produtos */}
        <div className="bg-white rounded-3xl border-2 border-gray-100 p-6">
          <h3 className="text-2xl font-black text-[#1D3461] mb-5">Top Produtos</h3>
          {carregando ? <div className="animate-pulse space-y-4">{Array(4).fill(0).map((_,i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}</div> : (
            <div className="space-y-4">
              {(dados?.ranking || []).map((v, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-2xl font-black text-gray-300 w-6">{i+1}</span>
                  <div className="flex-1">
                    <p className="font-black text-gray-900 text-base">{v.nome}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-400 text-sm font-semibold">{v.qtd} vendidos</span>
                      <span className="text-green-600 font-black text-base">{fmt(v.total)}</span>
                    </div>
                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1D3461] rounded-full" style={{ width: `${Math.min(100,(v.qtd / (dados?.ranking[0]?.qtd || 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {(!dados?.ranking || dados.ranking.length === 0) && <p className="text-gray-400 text-center py-8">Sem vendas ainda</p>}
            </div>
          )}
        </div>
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {[
          { href: "/org/produtos", emoji: "🍺", titulo: "Gerenciar Cardápio" },
          { href: "/org/operadores", emoji: "👥", titulo: "Ver Operadores" },
          { href: "/org/clientes", emoji: "👤", titulo: "Lista de Clientes" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="flex items-center gap-3 bg-white rounded-3xl border-2 border-gray-100 p-5 hover:border-[#1D3461] hover:shadow-lg transition-all group">
            <span className="text-3xl">{a.emoji}</span>
            <span className="font-black text-gray-900 text-lg group-hover:text-[#1D3461]">{a.titulo}</span>
            <span className="ml-auto text-gray-300 group-hover:text-[#1D3461] text-xl">→</span>
          </Link>
        ))}
      </div>

      {/* Modal QR Code */}
      {mostrarQrModal && eventoId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <h3 className="text-xl font-black text-[#1D3461] mb-2">QR Code de Cadastro</h3>
            <p className="text-sm text-gray-500 mb-6 font-semibold">Mostre para seus clientes ou imprima</p>
            
            <div className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-100 mb-6 flex justify-center">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent((typeof window !== 'undefined' ? window.location.origin : '') + '/e/' + eventoId)}`} 
                alt="QR Code Auto-Cadastro" 
                className="w-48 h-48 object-contain rounded-xl"
              />
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent((typeof window !== 'undefined' ? window.location.origin : '') + '/e/' + eventoId)}`;
                  link.download = `QRCode_Cadastro_Evento.png`;
                  link.target = "_blank";
                  link.click();
                }}
                className="w-full bg-[#1D3461] hover:bg-blue-900 text-white font-black px-6 py-3.5 rounded-2xl transition-all flex justify-center items-center gap-2"
              >
                <span>⬇️</span> Baixar Imagem HD
              </button>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/e/${eventoId}`);
                  alert('Link copiado para a área de transferência!');
                }}
                className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold px-6 py-3.5 rounded-2xl transition-all flex justify-center items-center gap-2"
              >
                <span>🔗</span> Copiar Link
              </button>

              <button
                onClick={() => setMostrarQrModal(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-6 py-3.5 rounded-2xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
