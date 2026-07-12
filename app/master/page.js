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
    { label: "Eventos Ativos", valor: metrics.eventosAtivos.toString(), emoji: "🎪", cor: "bg-blue-50 text-blue-700" },
    { label: "Cartões Emitidos", valor: metrics.cartoesEmitidos.toString(), emoji: "💳", cor: "bg-green-50 text-green-700" },
    { label: "Total Recarregado", valor: `R$ ${metrics.totalRecarregado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, emoji: "💰", cor: "bg-yellow-50 text-yellow-700" },
    { label: "Taxa La More", valor: `R$ ${metrics.taxaLaMore.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, emoji: "👑", cor: "bg-purple-50 text-purple-700" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-4xl font-black text-[#1D3461] mb-2">Dashboard</h2>
      <p className="text-gray-500 text-lg font-semibold mb-8">Visão geral da plataforma</p>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
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
  );
}
