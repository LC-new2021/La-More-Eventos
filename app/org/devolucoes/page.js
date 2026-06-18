"use client";

import { useState, useEffect } from "react";

export default function DevolucoesPage() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState(null);

  useEffect(() => {
    carregarSolicitacoes();
  }, []);

  const carregarSolicitacoes = async () => {
    try {
      const storedEventoId = localStorage.getItem("activeEventoId");
      const url = storedEventoId ? `/api/org/devolucoes?eventoId=${storedEventoId}` : "/api/org/devolucoes";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSolicitacoes(data);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar devoluções");
    } finally {
      setLoading(false);
    }
  };

  const marcarComoConcluida = async (id) => {
    if (!confirm("Confirmar que você já enviou o PIX para este cliente?")) return;
    
    setProcessandoId(id);
    try {
      const res = await fetch("/api/org/devolucoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "CONCLUIDA" })
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      await carregarSolicitacoes();
    } catch (e) {
      alert(e.message);
    } finally {
      setProcessandoId(null);
    }
  };

  if (loading) return <div className="p-8 text-center font-bold">Carregando...</div>;

  const pendentes = solicitacoes.filter(s => s.status === 'PENDENTE');
  const concluidas = solicitacoes.filter(s => s.status === 'CONCLUIDA');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Devoluções de Saldo</h1>
        <p className="text-gray-500 text-sm">Gerencie os pedidos de reembolso solicitados pelos clientes no Cartão Digital.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-sm font-bold text-gray-500 uppercase">Aguardando PIX</p>
          <p className="text-3xl font-black text-rose-600 mt-1">{pendentes.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-sm font-bold text-gray-500 uppercase">Devoluções Feitas</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{concluidas.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-black">
              <tr>
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Chave PIX</th>
                <th className="px-6 py-4 text-right">Valor a Devolver</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {solicitacoes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-400 font-semibold">Nenhuma solicitação encontrada.</td>
                </tr>
              ) : solicitacoes.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-600">
                    {new Date(s.criadoEm).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">
                    {s.cartao.cliente.nome}<br/>
                    <span className="text-xs text-gray-400 font-medium">Cartão: {s.cartao.codigo}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-gray-100 text-gray-800 font-mono text-xs px-2 py-1 rounded-md border border-gray-200">
                      {s.chavePix}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-rose-600">
                    R$ {s.valor.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {s.status === 'PENDENTE' ? (
                      <span className="bg-rose-100 text-rose-700 font-bold text-xs px-3 py-1 rounded-full">PENDENTE</span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-700 font-bold text-xs px-3 py-1 rounded-full">PAGO</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {s.status === 'PENDENTE' && (
                      <button 
                        onClick={() => marcarComoConcluida(s.id)}
                        disabled={processandoId === s.id}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
                      >
                        {processandoId === s.id ? '...' : '✔ Marcar Pago'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
