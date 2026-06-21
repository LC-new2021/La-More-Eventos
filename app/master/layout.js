"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const menuItens = [
  { href: "/master", emoji: "📊", titulo: "Dashboard", exact: true },
  { href: "/master/eventos", emoji: "🎪", titulo: "Eventos" },
  { href: "/master/usuarios", emoji: "👥", titulo: "Usuários" },
  { href: "/master/clientes", emoji: "👤", titulo: "Clientes" },
  { href: "/master/devolucoes", emoji: "💸", titulo: "Devoluções" },
  { href: "/master/financeiro", emoji: "💰", titulo: "Financeiro" },
  { href: "/master/relatorios", emoji: "📈", titulo: "Relatórios" },
  { href: "/master/auditoria", emoji: "🔍", titulo: "Auditoria" },
];

export default function MasterLayout({ children }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar (Desktop) */}
      <aside className="hidden lg:flex lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-64 bg-[#1D3461] text-white flex-col z-10 overflow-y-auto custom-scrollbar">
        <div className="p-6 border-b border-white/10">
          <Link href="/master" className="flex flex-col text-left group cursor-pointer focus:outline-none w-full">
            <h1 className="font-black text-xl leading-tight group-hover:text-blue-200 transition-colors">Lamore Eventos</h1>
            <p className="text-blue-300 text-sm font-semibold mt-0.5">Painel Master</p>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItens.map((item) => {
            const ativo = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && item.href !== "/master";
            const isAtivo = ativo || (item.exact && pathname === item.href);

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
          <div className="px-4 py-3 bg-yellow-500/20 rounded-2xl">
            <p className="text-yellow-300 text-xs font-black uppercase tracking-widest">Perfil</p>
            <p className="text-white font-bold text-base">👑 Master Admin</p>
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
      <main className="ml-0 lg:ml-64 flex-1 p-4 md:p-8 pb-28 lg:pb-8 w-full max-w-full overflow-hidden">
        {/* Mobile Header indicator */}
        <div className="flex items-center justify-between bg-[#1D3461] text-white p-4 rounded-2xl mb-6 lg:hidden shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👑</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-200 uppercase tracking-wider">Painel Master</p>
              <p className="font-black text-base truncate">Lamore Eventos</p>
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
            : pathname.startsWith(item.href) && item.href !== "/master";
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
