"use client";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

const perfis = {
  MASTER: { href: "/master", titulo: "Painel Master", desc: "Gestão completa: eventos, taxas, auditoria.", emoji: "👑", cor: "bg-yellow-50", textoCor: "text-yellow-600", bgCor: "bg-yellow-100" },
  ORGANIZADOR: { href: "/org", titulo: "Retaguarda do Produtor", desc: "Cardápio, operadores, relatórios e acompanhamento.", emoji: "🎯", cor: "bg-blue-50", textoCor: "text-blue-600", bgCor: "bg-blue-100" },
  SUPORTE_OPERACIONAL: { href: "/org", titulo: "Retaguarda (Suporte Operacional)", desc: "Acompanhamento ao vivo, cardápio (criar produtos), operadores e clientes.", emoji: "🛠️", cor: "bg-teal-50", textoCor: "text-teal-600", bgCor: "bg-teal-100" },
  CAIXA: { href: "/pos", titulo: "Caixa de Entrada (POS / Vendas)", desc: "Cadastro de clientes, venda de créditos e QR Code.", emoji: "💳", cor: "bg-green-50", textoCor: "text-green-600", bgCor: "bg-green-100" },
  TESOURARIA: { href: "/pos", titulo: "Tesouraria (Acesso Multi)", desc: "Cadastro de clientes, vendas em dinheiro, cartão e Pix.", emoji: "💵", cor: "bg-purple-50", textoCor: "text-purple-600", bgCor: "bg-purple-100" },
  OPERADOR_BAR: { href: "/bar", titulo: "Operador de Bar", desc: "Escanear QR, selecionar produto e confirmar débito.", emoji: "🍺", cor: "bg-orange-50", textoCor: "text-orange-600", bgCor: "bg-orange-100" },
};

perfis.CLIENTE = perfis.SUPORTE_OPERACIONAL;
perfis.SUPORTE = perfis.SUPORTE_OPERACIONAL;

const perfisMaster = [
  { roleKey: "ORGANIZADOR", ...perfis.ORGANIZADOR },
  { roleKey: "SUPORTE_OPERACIONAL", ...perfis.SUPORTE_OPERACIONAL },
  { roleKey: "CAIXA", ...perfis.CAIXA },
  { roleKey: "TESOURARIA", ...perfis.TESOURARIA },
  { roleKey: "OPERADOR_BAR", ...perfis.OPERADOR_BAR },
];

const perfisSuporte = [
  { roleKey: "CAIXA", ...perfis.CAIXA },
  { roleKey: "TESOURARIA", ...perfis.TESOURARIA },
  { roleKey: "OPERADOR_BAR", ...perfis.OPERADOR_BAR },
];

export default function AcessosPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const perfil = perfis[role];

  const [evento, setEvento] = useState(null);
  const [saindo, setSaindo] = useState(false);
  const eventoId = session?.user?.eventoId;

  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.replace("/login");
    }
  }, [status]);

  useEffect(() => {
    const targetId = eventoId || (typeof window !== "undefined" ? localStorage.getItem("activeEventoId") : null);
    if (targetId) {
      fetch(`/api/eventos/${targetId}`)
        .then(r => r.json())
        .then(data => {
          if (!data.error) setEvento(data);
        })
        .catch(console.error);
    }
  }, [eventoId]);

  const handleLogout = async () => {
    setSaindo(true);
    try {
      await signOut({ redirect: false });
    } catch {}
    window.location.replace("/login");
  };

  const isMaster = role === "MASTER";
  const isSupport = role === "SUPORTE_OPERACIONAL" || role === "CLIENTE" || role === "SUPORTE";
  const canSwitchSectors = isMaster || isSupport;
  const listaAlternar = isMaster ? perfisMaster : isSupport ? perfisSuporte : [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6 sm:mb-8 pt-2 sm:pt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-3xl shadow-xl mb-3 sm:mb-4 overflow-hidden p-1 border border-gray-200">
            <img src="/logo.png?v=3" alt="La More Automação Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[#1D3461]">La More Eventos</h1>
          {session?.user?.nome && (
            <div>
              <p className="text-gray-600 text-base sm:text-lg font-semibold mt-1">Olá, {session.user.nome}!</p>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                Função: {
                  isMaster ? "👑 Administrador Master" :
                  role === "ORGANIZADOR" ? "🎯 Produtor / Organizador" :
                  isSupport ? "🛠️ Suporte Operacional" :
                  role === "CAIXA" ? "💳 Operador de Caixa" :
                  role === "TESOURARIA" ? "💵 Tesouraria" :
                  role === "OPERADOR_BAR" ? "🍺 Operador de Bar" : role
                }
              </p>
              {evento && (
                <p className="text-[#1D3461] text-sm sm:text-base font-black mt-2 bg-blue-50/50 border border-blue-100 rounded-full px-4 py-1.5 inline-block max-w-full truncate">
                  🎪 Evento Vinculado: {evento.nome}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Acesso direto ao perfil principal do usuário logado */}
          {perfil && (
            <a 
              href={perfil.href} 
              className={`flex items-center gap-4 sm:gap-5 p-4 sm:p-5 ${perfil.cor} rounded-3xl border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all group cursor-pointer block`}
            >
              <div className={`w-14 h-14 sm:w-16 sm:h-16 ${perfil.bgCor} rounded-2xl flex items-center justify-center shrink-0 text-2xl sm:text-3xl`}>{perfil.emoji}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${perfil.textoCor} mb-1`}>
                  Seu Painel Principal
                </p>
                <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">{perfil.titulo}</h2>
                <p className="text-gray-500 text-xs sm:text-sm mt-1">{perfil.desc}</p>
              </div>
              <span className="text-xl sm:text-2xl text-gray-300 group-hover:text-[#1D3461] transition-colors shrink-0">→</span>
            </a>
          )}

          {/* Apenas Master e Suporte Operacional podem alternar entre setores da festa */}
          {canSwitchSectors && listaAlternar.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-3">
                {isMaster ? "Acesso Total aos Setores (Master)" : "Apoio aos Setores da Festa (Suporte Operacional)"}
              </p>
              <div className="space-y-3">
                {listaAlternar.map((p) => (
                  <a 
                    key={p.roleKey} 
                    href={p.href} 
                    className="flex items-center gap-4 sm:gap-5 p-4 bg-white rounded-3xl border-2 border-gray-100 hover:border-[#1D3461]/40 shadow-sm hover:shadow-md transition-all group cursor-pointer block"
                  >
                    <div className={`w-12 h-12 ${p.bgCor} rounded-2xl flex items-center justify-center shrink-0 text-2xl`}>{p.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${p.textoCor}`}>{p.roleKey.replace("_", " ")}</p>
                      <h3 className="text-sm sm:text-base font-black text-gray-900 leading-tight">{p.titulo}</h3>
                      <p className="text-gray-400 text-xs mt-0.5 truncate">{p.desc}</p>
                    </div>
                    <span className="text-xl text-gray-300 group-hover:text-[#1D3461] transition-colors shrink-0">→</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Sair do sistema direto para /login */}
          {session && (
            <button 
              onClick={handleLogout} 
              disabled={saindo}
              className="w-full flex items-center justify-center gap-3 p-4 bg-white rounded-3xl border-2 border-red-100 text-red-600 font-black hover:bg-red-50 hover:border-red-300 transition-all cursor-pointer shadow-sm mt-4 text-sm sm:text-base"
            >
              {saindo ? "Saindo do sistema..." : "🚪 Sair do Sistema (Encerrar Sessão) →"}
            </button>
          )}

          {!session && status !== "loading" && (
            <Link href="/login" className="flex items-center justify-center gap-3 p-5 bg-[#1D3461] rounded-3xl text-white font-black text-xl">
              Fazer Login →
            </Link>
          )}
        </div>

        <p className="text-center text-gray-400 text-sm font-medium mt-10 pb-6">La More Eventos © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
