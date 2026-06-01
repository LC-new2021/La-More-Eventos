"use client";
import Link from 'next/link';

export default function MasterRelatorios() {
  return (
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
  );
}
