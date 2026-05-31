"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

const perfis = {
  MASTER: { href: "/master", titulo: "Painel Master", desc: "Gestão completa: eventos, taxas, auditoria.", emoji: "👑", cor: "bg-yellow-50", textoCor: "text-yellow-600", bgCor: "bg-yellow-100" },
  ORGANIZADOR: { href: "/org", titulo: "Retaguarda do Produtor", desc: "Cardápio, operadores, relatórios e acompanhamento.", emoji: "🎯", cor: "bg-blue-50", textoCor: "text-blue-600", bgCor: "bg-blue-100" },
  CAIXA: { href: "/pos", titulo: "Caixa de Entrada (POS)", desc: "Cadastro de clientes, venda de créditos e QR Code.", emoji: "💳", cor: "bg-green-50", textoCor: "text-green-600", bgCor: "bg-green-100" },
  OPERADOR_BAR: { href: "/bar", titulo: "Operador de Bar", desc: "Escanear QR, selecionar produto e confirmar débito.", emoji: "🍺", cor: "bg-orange-50", textoCor: "text-orange-600", bgCor: "bg-orange-100" },
};

export default function AcessosPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const perfil = perfis[role];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 pt-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-xl mb-4 overflow-hidden p-1 border border-gray-200">
            <img src="/logo.png?v=3" alt="La More Automação Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-black text-[#1D3461]">La More Eventos</h1>
          {session?.user?.nome && <p className="text-gray-500 text-lg font-semibold mt-1">Olá, {session.user.nome}!</p>}
        </div>

        <div className="space-y-4">
          {/* Acesso direto ao perfil do usuário logado */}
          {perfil && (
            <Link href={perfil.href} className={`flex items-center gap-5 p-5 ${perfil.cor} rounded-3xl border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all group`}>
              <div className={`w-16 h-16 ${perfil.bgCor} rounded-2xl flex items-center justify-center shrink-0 text-3xl`}>{perfil.emoji}</div>
              <div className="flex-1">
                <p className={`text-xs font-black uppercase tracking-widest ${perfil.textoCor} mb-1`}>{role}</p>
                <h2 className="text-xl font-black text-gray-900">{perfil.titulo}</h2>
                <p className="text-gray-500 text-sm mt-1">{perfil.desc}</p>
              </div>
              <span className="text-2xl text-gray-300 group-hover:text-[#1D3461] transition-colors">→</span>
            </Link>
          )}

          {/* Master pode acessar tudo */}
          {role === "MASTER" && Object.entries(perfis).filter(([r]) => r !== "MASTER").map(([r, p]) => (
            <Link key={r} href={p.href} className="flex items-center gap-5 p-5 bg-white rounded-3xl border-2 border-gray-100 hover:border-gray-300 shadow-sm hover:shadow-lg transition-all group">
              <div className={`w-16 h-16 ${p.bgCor} rounded-2xl flex items-center justify-center shrink-0 text-3xl`}>{p.emoji}</div>
              <div className="flex-1">
                <p className={`text-xs font-black uppercase tracking-widest ${p.textoCor} mb-1`}>{r}</p>
                <h2 className="text-xl font-black text-gray-900">{p.titulo}</h2>
                <p className="text-gray-500 text-sm mt-1">{p.desc}</p>
              </div>
              <span className="text-2xl text-gray-300 group-hover:text-[#1D3461] transition-colors">→</span>
            </Link>
          ))}

          {/* Sair */}
          {session && (
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="w-full flex items-center justify-center gap-3 p-4 bg-white rounded-3xl border-2 border-gray-100 text-gray-500 font-bold hover:border-red-200 hover:text-red-500 transition-all">
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
