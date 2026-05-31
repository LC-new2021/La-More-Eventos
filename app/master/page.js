"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

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
    { label: "Eventos Ativos", valor: metrics.eventosAtivos.toString(), emoji: "🎪", cor: "bg-blue-50 text-blue-700" },
    { label: "Cartões Emitidos", valor: metrics.cartoesEmitidos.toString(), emoji: "💳", cor: "bg-green-50 text-green-700" },
    { label: "Total Recarregado", valor: `R$ ${metrics.totalRecarregado.toFixed(2).replace('.', ',')}`, emoji: "💰", cor: "bg-yellow-50 text-yellow-700" },
    { label: "Taxa La More", valor: `R$ ${metrics.taxaLaMore.toFixed(2).replace('.', ',')}`, emoji: "👑", cor: "bg-purple-50 text-purple-700" },
  ];

  const handleHeaderClick = (e) => {
    e.preventDefault();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-[#1D3461] text-white flex flex-col z-10">
        <div className="p-6 border-b border-white/10">
          <button 
            onClick={handleHeaderClick}
            className="flex flex-col text-left group cursor-pointer focus:outline-none w-full"
          >
            <h1 className="font-black text-xl leading-tight group-hover:text-blue-200 transition-colors">Lamore Eventos</h1>
            <p className="text-blue-300 text-sm font-semibold mt-0.5">Painel Master</p>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-blue-100 hover:bg-white/10 hover:text-white transition-all font-semibold text-lg"
            >
              <span className="text-2xl">{item.emoji}</span>
              {item.titulo}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="px-4 py-3 bg-yellow-500/20 rounded-2xl">
            <p className="text-yellow-300 text-xs font-black uppercase tracking-widest">Perfil</p>
            <p className="text-white font-bold text-base">👑 Master Admin</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-200 hover:text-white rounded-2xl font-bold text-sm transition-all cursor-pointer"
          >
            Sair do Sistema →
          </button>
          <Link href="/acessos" className="flex items-center justify-center gap-2 px-4 py-1.5 text-blue-200 hover:text-white transition-colors font-semibold text-sm">
            ← Portal de Acessos
          </Link>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="ml-64 p-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-black text-[#1D3461] mb-2">Dashboard</h2>
          <p className="text-gray-500 text-lg font-semibold mb-8">Visão geral da plataforma</p>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-2 gap-6 mb-10">
            {statsCards.map((card) => (
              <div key={card.label} className={`${card.cor} rounded-3xl p-6 flex items-center gap-4 border border-gray-100 shadow-sm`}>
                <span className="text-5xl">{card.emoji}</span>
                <div>
                  <p className="font-black text-3xl">{loading ? '...' : card.valor}</p>
                  <p className="font-semibold text-lg opacity-80">{card.label}</p>
                </div>
              </div>
            ))}
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
                <span className="ml-auto text-gray-300 group-hover:text-[#1D3461] text-2xl">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
