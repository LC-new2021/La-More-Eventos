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
