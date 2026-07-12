"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

const menuItens = [
  { href: "/org", emoji: "📊", titulo: "Dashboard", exact: true },
  { href: "/org/produtos", emoji: "🍺", titulo: "Cardápio" },
  { href: "/org/operadores", emoji: "👥", titulo: "Operadores" },
  { href: "/org/clientes", emoji: "👤", titulo: "Clientes" },
  { href: "/org/relatorios", emoji: "📈", titulo: "Relatórios" },
  { href: "/org/configuracoes", emoji: "⚙️", titulo: "Financeiro" },
];

export default function OrgLayout({ children }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [evento, setEvento] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  const isMaster = session?.user?.role === 'MASTER';
  const [eventoId, setEventoId] = useState(null);

  useEffect(() => {
    if (session) {
      if (isMaster) {
        const stored = localStorage.getItem("activeEventoId");
        setEventoId(stored);
        
        // Buscar todos os eventos para a listagem do MASTER
        fetch('/api/eventos')
          .then(res => res.json())
          .then(data => {
            if (!data.error) {
              setEventos(data);
              if (!stored && data.length > 0) {
                localStorage.setItem("activeEventoId", data[0].id);
                setEventoId(data[0].id);
                window.location.reload();
              }
            }
          });
      } else {
        setEventoId(session.user.eventoId);
      }
    }
  }, [session, isMaster]);

  useEffect(() => {
    if (eventoId) {
      setLoading(true);
      fetch(`/api/eventos/${eventoId}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) setEvento(data);
        })
        .catch((err) => console.error("Erro ao buscar evento no layout:", err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [eventoId]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar (Desktop) */}
      <aside className="hidden lg:flex lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-64 bg-[#1D3461] text-white flex-col z-10 overflow-y-auto custom-scrollbar">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl shadow-md overflow-hidden p-1 flex items-center justify-center shrink-0 border border-white/10">
              <img src="/logo.png?v=3" alt="La More Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-black text-lg leading-tight">Retaguarda</h1>
              <p className="text-blue-200 text-sm font-semibold">Produtor</p>
            </div>
          </div>
          {/* Evento ativo */}
          <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3">
            <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">Evento Ativo</p>
            {isMaster ? (
              <select
                value={eventoId || ""}
                onChange={(e) => {
                  localStorage.setItem("activeEventoId", e.target.value);
                  setEventoId(e.target.value);
                  window.location.reload();
                }}
                className="w-full bg-[#152544] text-white rounded-xl px-2 py-1.5 font-bold text-sm outline-none border-2 border-white/10 focus:border-white/30 transition-all cursor-pointer"
              >
                <option value="">Selecione o Evento...</option>
                {eventos.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.nome}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <p className="text-white font-black text-base truncate">
                  {loading ? "Carregando..." : (evento ? evento.nome : "Sem evento vinculado")}
                </p>
                <p className="text-blue-200 text-sm">
                  {evento?.data ? new Date(evento.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : "—"}
                </p>
              </>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItens.map((item) => {
            const ativo = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && item.href !== "/org";
            const ativoExato = item.exact && pathname === item.href;
            const isAtivo = ativo || ativoExato;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-lg transition-all ${
                  isAtivo
                    ? "bg-white text-[#1D3461]"
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="text-2xl">{item.emoji}</span>
                {item.titulo}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="px-4 py-3 bg-blue-800/50 rounded-2xl">
            <p className="text-blue-300 text-xs font-black uppercase tracking-widest">Perfil</p>
            <p className="text-white font-bold text-base">🎯 Produtor</p>
          </div>
          <button
            onClick={async () => {
              await signOut({ redirect: false });
              window.location.href = "/login";
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-200 hover:text-white rounded-2xl font-bold text-sm transition-all cursor-pointer"
          >
            Sair do Sistema →
          </button>
          <Link
            href="/acessos"
            className="flex items-center justify-center gap-2 px-4 py-1.5 text-blue-200 hover:text-white transition-colors font-semibold text-sm"
          >
            ← Portal de Acessos
          </Link>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="ml-0 lg:ml-64 flex-1 p-4 md:p-8 pb-28 lg:pb-8 min-w-0 w-full overflow-x-hidden">
        {/* Mobile Header indicator */}
        <div className="flex items-center justify-between bg-[#1D3461] text-white p-4 rounded-2xl mb-6 lg:hidden shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎪</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-200 uppercase tracking-wider">Evento Ativo</p>
              <p className="font-black text-base truncate">{loading ? "..." : (evento ? evento.nome : "Sem evento")}</p>
            </div>
          </div>
          <Link href="/acessos" className="text-xs font-black bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">Sair</Link>
        </div>

        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#1D3461] border-t border-white/10 flex flex-nowrap overflow-x-auto gap-2 p-2 z-20 lg:hidden text-white shadow-xl custom-scrollbar items-center justify-start">
        {menuItens.map((item) => {
          const ativo = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href) && item.href !== "/org";
          const isAtivo = ativo || (item.exact && pathname === item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center p-2 rounded-xl transition-all shrink-0 min-w-[70px] ${
                isAtivo ? "text-yellow-400 font-black bg-white/5" : "text-blue-200"
              }`}
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-[10px] font-bold mt-1 text-center" title={item.titulo}>{item.titulo}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
