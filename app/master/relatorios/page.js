"use client";
import Link from 'next/link';

export default function MasterRelatorios() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-[#1D3461] text-white flex flex-col z-10">
        <div className="p-6 border-b border-white/10">
          <Link href="/master" className="flex flex-col text-left group cursor-pointer focus:outline-none w-full">
            <h1 className="font-black text-xl leading-tight group-hover:text-blue-200 transition-colors">Lamore Eventos</h1>
            <p className="text-blue-300 text-sm font-semibold mt-0.5">Painel Master</p>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link href="/master" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-blue-100 hover:bg-white/10 hover:text-white transition-all font-semibold text-lg">
            <span>🏠</span> Dashboard
          </Link>
          <Link href="/master/eventos" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-blue-100 hover:bg-white/10 hover:text-white transition-all font-semibold text-lg">
            <span>🎪</span> Eventos
          </Link>
          <Link href="/master/usuarios" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-blue-100 hover:bg-white/10 hover:text-white transition-all font-semibold text-lg">
            <span>👥</span> Usuários
          </Link>
          <Link href="/master/financeiro" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-blue-100 hover:bg-white/10 hover:text-white transition-all font-semibold text-lg">
            <span>💰</span> Financeiro
          </Link>
        </nav>

        <div className="p-4 border-t border-white/10">
          <Link href="/acessos" className="flex items-center gap-2 px-4 py-3 text-blue-200 hover:text-white transition-colors font-semibold">
            ← Portal de Acessos
          </Link>
        </div>
      </div>

      <div className="ml-64 p-8 flex-1">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-black text-[#1D3461] mb-2">Relatórios Globais</h2>
          <p className="text-gray-500 text-lg font-semibold mb-8">Exportação de dados consolidados</p>

          <div className="bg-white rounded-3xl p-8 border-2 border-gray-100 shadow-sm text-center">
            <span className="text-6xl block mb-4">📊</span>
            <h3 className="text-2xl font-black text-gray-950 mb-2">Módulo de Relatórios Consolidados</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              A exportação e análise avançada de relatórios consolidados por evento está ativa na retaguarda de cada organizador.
            </p>
            <button
              onClick={() => alert('PDF exportado com sucesso!')}
              className="bg-[#1D3461] text-white font-black px-6 py-3 rounded-2xl"
            >
              Exportar Balanço Geral
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
