"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MasterAuditoria() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/master/auditoria')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setLogs(data);
      })
      .catch(() => setError('Erro ao carregar log de auditoria'))
      .finally(() => setLoading(false));
  }, []);

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

      {/* Conteúdo Principal */}
      <div className="ml-64 p-8 flex-1">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-black text-[#1D3461] mb-2">Auditoria do Sistema</h2>
          <p className="text-gray-500 text-lg font-semibold mb-8">Log em tempo real de todas as movimentações e ações de caixas e bars</p>

          {error && (
            <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <p className="text-[#1D3461] text-xl font-bold">Carregando auditoria...</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-100 text-gray-500 font-bold">
                    <th className="p-6">Data/Hora</th>
                    <th className="p-6">Evento</th>
                    <th className="p-6">Tipo</th>
                    <th className="p-6">Cliente / Cartão</th>
                    <th className="p-6">Operador</th>
                    <th className="p-6">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="p-6 text-sm text-gray-500">
                        {new Date(log.criadaEm).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-6 text-sm text-gray-900 font-bold">
                        {log.cartao?.evento?.nome || 'Sem Evento'}
                      </td>
                      <td className="p-6">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          log.tipo === 'RECARGA' ? 'bg-green-100 text-green-700' :
                          log.tipo === 'DEBITO' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {log.tipo}
                        </span>
                      </td>
                      <td className="p-6 text-sm">
                        <p className="font-bold text-gray-950">{log.cartao?.cliente?.nome || '—'}</p>
                        <p className="text-gray-400 font-bold text-xs uppercase">Cód: {log.cartao?.codigo}</p>
                      </td>
                      <td className="p-6 text-sm">
                        <p className="font-bold">{log.operador?.nome || 'Sistema'}</p>
                        <p className="text-gray-400 text-xs font-black uppercase">{log.operador?.role?.replace('_', ' ')}</p>
                      </td>
                      <td className={`p-6 font-black text-lg ${
                        log.tipo === 'RECARGA' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {log.tipo === 'RECARGA' ? '+' : '-'} R$ {log.valor.toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
