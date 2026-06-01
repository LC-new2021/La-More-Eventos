"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MasterFinanceiro() {
  const [financeiro, setFinanceiro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/master/financeiro')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setFinanceiro(data);
      })
      .catch(() => setError('Erro ao buscar dados financeiros'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-4xl font-black text-[#1D3461] mb-2">Financeiro & Royalties</h2>
      <p className="text-gray-500 text-lg font-semibold mb-8">Controle de taxas e faturamento global da plataforma</p>

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-[#1D3461] text-xl font-bold">Carregando dados financeiros...</p>
        </div>
      ) : (
        <>
          {/* Resumo Global */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 flex items-center gap-4">
              <span className="text-5xl">💰</span>
              <div>
                <p className="text-gray-400 text-sm font-bold uppercase">Volume Total Processado</p>
                <p className="font-black text-3xl text-gray-900">
                  R$ {financeiro.totalRecarregadoGlobal.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>

            <div className="bg-purple-50 rounded-3xl p-6 border-2 border-purple-100 flex items-center gap-4">
              <span className="text-5xl">👑</span>
              <div>
                <p className="text-purple-600 text-sm font-bold uppercase">Total Taxa La More (Royalties)</p>
                <p className="font-black text-3xl text-purple-900">
                  R$ {financeiro.totalTaxaMasterGlobal.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
          </div>

          {/* Faturamento por Evento */}
          <h3 className="text-2xl font-black text-[#1D3461] mb-4">Faturamento por Evento</h3>
          <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-100 text-gray-500 font-bold">
                    <th className="p-6">Evento</th>
                    <th className="p-6">Taxa (%)</th>
                    <th className="p-6">Volume Total</th>
                    <th className="p-6">Royalty (La More)</th>
                    <th className="p-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                  {financeiro.eventos.map((evt) => (
                    <tr key={evt.id} className="hover:bg-gray-50/50">
                      <td className="p-6 font-bold text-gray-900">{evt.nome}</td>
                      <td className="p-6">{evt.taxaMasterPercent}%</td>
                      <td className="p-6">R$ {evt.totalRecarregado.toFixed(2).replace('.', ',')}</td>
                      <td className="p-6 text-purple-700 font-bold">
                        R$ {evt.totalTaxaMaster.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="p-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          evt.status === 'ATIVO' ? 'bg-green-100 text-green-700' :
                          evt.status === 'CONFIGURANDO' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {evt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
