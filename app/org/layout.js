"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItens = [
  { href: "/org", emoji: "📊", titulo: "Dashboard", exact: true },
  { href: "/org/produtos", emoji: "🍺", titulo: "Cardápio" },
  { href: "/org/operadores", emoji: "👥", titulo: "Operadores" },
  { href: "/org/clientes", emoji: "👤", titulo: "Clientes" },
  { href: "/org/relatorios", emoji: "📈", titulo: "Relatórios" },
];

export default function OrgLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#1D3461] text-white flex flex-col z-10">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎯</span>
            <div>
              <h1 className="font-black text-lg leading-tight">Retaguarda</h1>
              <p className="text-blue-200 text-sm font-semibold">Produtor</p>
            </div>
          </div>
          {/* Evento ativo */}
          <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3">
            <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">Evento Ativo</p>
            <p className="text-white font-black text-base truncate">Evento Demonstração</p>
            <p className="text-blue-200 text-sm">15/06/2026</p>
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
          <Link
            href="/acessos"
            className="flex items-center gap-2 px-4 py-2 text-blue-200 hover:text-white transition-colors font-semibold text-base"
          >
            ← Portal de Acessos
          </Link>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="ml-64 flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
