"use client";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

const perfis = {
  MASTER: { href: "/master", titulo: "Painel Master", desc: "Gestão completa: eventos, taxas, auditoria.", emoji: "👑", cor: "bg-yellow-50", textoCor: "text-yellow-600", bgCor: "bg-yellow-100" },
  ORGANIZADOR: { href: "/org", titulo: "Retaguarda do Produtor", desc: "Cardápio, operadores, relatórios e acompanhamento.", emoji: "🎯", cor: "bg-blue-50", textoCor: "text-blue-600", bgCor: "bg-blue-100" },
  CAIXA: { href: "/pos", titulo: "Caixa de Entrada (POS)", desc: "Cadastro de clientes, venda de créditos e QR Code.", emoji: "💳", cor: "bg-green-50", textoCor: "text-green-600", bgCor: "bg-green-100" },
  TESOURARIA: { href: "/pos", titulo: "Tesouraria (Caixa Físico)", desc: "Cadastro de clientes, vendas em dinheiro, cartão e Pix.", emoji: "💵", cor: "bg-purple-50", textoCor: "text-purple-600", bgCor: "bg-purple-100" },
  OPERADOR_BAR: { href: "/bar", titulo: "Operador de Bar", desc: "Escanear QR, selecionar produto e confirmar débito.", emoji: "🍺", cor: "bg-orange-50", textoCor: "text-orange-600", bgCor: "bg-orange-100" },
};

export default function AcessosPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const perfil = perfis[role];

  const [evento, setEvento] = useState(null);
  const eventoId = session?.user?.eventoId;

  // Redirecionamento automático para funções de frente de caixa
  useEffect(() => {
    if (role === 'CAIXA' || role === 'TESOURARIA') {
      // Usar window.location para forçar hard navigation e burlar qualquer cache do Next
      window.location.replace('/pos');
    }
  }, [role]);

  useEffect(() => {
    if (eventoId) {
      fetch(`/api/eventos/${eventoId}`)
        .then(r => r.json())
        .then(data => {
          if (!data.error) setEvento(data);
        })
        .catch(console.error);
    }
  }, [eventoId]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 pt-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-xl mb-4 overflow-hidden p-1 border border-gray-200">
            <img src="/logo.png?v=3" alt="La More Automação Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-black text-[#1D3461]">La More Eventos</h1>
          {session?.user?.nome && (
            <div>
              <p className="text-gray-500 text-lg font-semibold mt-1">Olá, {session.user.nome}!</p>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                Função: {
                  role === "MASTER" ? "👑 Administrador Master" :
                  role === "ORGANIZADOR" ? "🎯 Produtor / Organizador" :
                  role === "CAIXA" ? "💳 Operador de Caixa" :
                  role === "OPERADOR_BAR" ? "🍺 Operador de Bar" : role
                }
              </p>
              {evento && (
                <p className="text-[#1D3461] text-base font-black mt-2 bg-blue-50/50 border border-blue-100 rounded-full px-4 py-1.5 inline-block">
                  🎪 Evento Vinculado: {evento.nome}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Acesso direto ao perfil do usuário logado */}
          {perfil && (
            <a href={`${perfil.href}?v=${new Date().getTime()}`} className={`flex items-center gap-5 p-5 ${perfil.cor} rounded-3xl border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all group cursor-pointer block`}>
              <div className={`w-16 h-16 ${perfil.bgCor} rounded-2xl flex items-center justify-center shrink-0 text-3xl`}>{perfil.emoji}</div>
              <div className="flex-1">
                <p className={`text-xs font-black uppercase tracking-widest ${perfil.textoCor} mb-1`}>{role}</p>
                <h2 className="text-xl font-black text-gray-900">{perfil.titulo}</h2>
                <p className="text-gray-500 text-sm mt-1">{perfil.desc}</p>
              </div>
              <span className="text-2xl text-gray-300 group-hover:text-[#1D3461] transition-colors">→</span>
            </a>
          )}

          {/* Master pode acessar tudo */}
          {role === "MASTER" && Object.entries(perfis).filter(([r]) => r !== "MASTER").map(([r, p]) => (
            <a key={r} href={`${p.href}?v=${new Date().getTime()}`} className="flex items-center gap-5 p-5 bg-white rounded-3xl border-2 border-gray-100 hover:border-gray-300 shadow-sm hover:shadow-lg transition-all group cursor-pointer block">
              <div className={`w-16 h-16 ${p.bgCor} rounded-2xl flex items-center justify-center shrink-0 text-3xl`}>{p.emoji}</div>
              <div className="flex-1">
                <p className={`text-xs font-black uppercase tracking-widest ${p.textoCor} mb-1`}>{r}</p>
                <h2 className="text-xl font-black text-gray-900">{p.titulo}</h2>
                <p className="text-gray-500 text-sm mt-1">{p.desc}</p>
              </div>
              <span className="text-2xl text-gray-300 group-hover:text-[#1D3461] transition-colors">→</span>
            </a>
          ))}

          {/* Sair */}
          {session && (
            <button 
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.href = "/login";
              }} 
              className="w-full flex items-center justify-center gap-3 p-4 bg-white rounded-3xl border-2 border-gray-100 text-gray-500 font-bold hover:border-red-200 hover:text-red-500 transition-all cursor-pointer"
            >
              Sair do sistema →
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
