"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function OrgDashboard() {
  const { data: session } = useSession();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [eventoId, setEventoId] = useState(null);

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

  const fmt = (v) => `R$ ${(v || 0).toFixed(2).replace(".", ",")}`;
  const fmtHora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const metricas = dados ? [
    { label: "Total Recarregado", valor: fmt(dados.totalRecarregado), emoji: "💰", cor: "bg-green-50 text-green-700 border-green-100" },
    { label: "Cartões Ativos", valor: dados.cartoesAtivos, emoji: "💳", cor: "bg-blue-50 text-blue-700 border-blue-100" },
    { label: "Saldo em Aberto", valor: fmt(dados.saldoEmAberto), emoji: "⏳", cor: "bg-yellow-50 text-yellow-700 border-yellow-100" },
    { label: "Pedidos Realizados", valor: dados.totalPedidos, emoji: "🧾", cor: "bg-purple-50 text-purple-700 border-purple-100" },
  ] : [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-4xl font-black text-[#1D3461]">Dashboard</h2>
          <p className="text-gray-500 text-lg font-semibold mt-1">
            {carregando ? "Carregando..." : <span className="text-green-600 font-black">● AO VIVO</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/org/relatorios" className="bg-gray-100 text-gray-700 font-black text-base px-6 py-3 rounded-2xl hover:bg-gray-200 transition-all">📊 Exportar</Link>
        </div>
      </div>

      {dados && (
        <div className={`mb-6 p-4 rounded-2xl border-2 flex items-center justify-between font-black text-sm ${
          dados.mercadoPagoUserId 
            ? 'bg-green-50 border-green-100 text-green-700' 
            : 'bg-yellow-50 border-yellow-100 text-yellow-700'
        }`}>
          <div>
            <span>🔌 Recebimento: </span>
            <span>
              {dados.mercadoPagoUserId 
                ? `Split Ativo (Conta Mercado Pago vinculada - ID: ${dados.mercadoPagoUserId})` 
                : 'Configuração Padrão (Sem split ativo)'}
            </span>
          </div>
          <span className="text-xs opacity-75 font-semibold">
            {dados.mercadoPagoUserId ? '🟩 CONFIGURADO' : '⚠️ VINCULAÇÃO OPCIONAL VIA MASTER'}
          </span>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {carregando ? (
          Array(4).fill(0).map((_,i) => <div key={i} className="bg-gray-100 rounded-3xl p-5 h-28 animate-pulse" />)
        ) : metricas.map((m) => (
          <div key={m.label} className={`${m.cor} border-2 rounded-3xl p-5`}>
            <span className="text-4xl block mb-2">{m.emoji}</span>
            <p className="text-3xl font-black">{m.valor}</p>
            <p className="text-base font-semibold opacity-80 mt-1">{m.label}</p>
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
    </div>
  );
}
