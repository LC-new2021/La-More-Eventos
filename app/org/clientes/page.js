"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function ClientesPage() {
  const { data: session } = useSession();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [error, setError] = useState("");

  const [eventoId, setEventoId] = useState(null);

  useEffect(() => {
    if (session) {
      if (session.user.role === 'MASTER') {
        const stored = localStorage.getItem("activeEventoId");
        if (stored) {
          setEventoId(stored);
        } else {
          fetch("/api/eventos")
            .then((res) => res.json())
            .then((data) => {
              if (data && data.length > 0) {
                localStorage.setItem("activeEventoId", data[0].id);
                setEventoId(data[0].id);
              }
            });
        }
      } else {
        setEventoId(session.user.eventoId);
      }
    }
  }, [session]);

  useEffect(() => {
    if (eventoId) {
      carregarClientes();
    }
  }, [eventoId, busca]);

  const carregarClientes = async () => {
    try {
      const res = await fetch(`/api/clientes?eventoId=${eventoId}&q=${busca}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setClientes(data);
    } catch (e) {
      setError("Erro ao buscar lista de clientes");
    } finally {
      setLoading(false);
    }
  };

  const totalSaldo = clientes.reduce((acc, c) => acc + (c.saldo || 0), 0);

  if (!eventoId) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-bold text-xl">Este usuário organizador não está vinculado a um evento.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-4xl font-black text-[#1D3461]">Clientes</h2>
        <p className="text-gray-500 text-lg font-semibold mt-1">
          {clientes.length} clientes com cartão ativo neste evento
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-5">
          <span className="text-4xl">👤</span>
          <p className="text-3xl font-black text-blue-700 mt-2">{clientes.length}</p>
          <p className="text-blue-600 font-bold text-lg">Total de Clientes</p>
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-100 rounded-3xl p-5">
          <span className="text-4xl">⏳</span>
          <p className="text-3xl font-black text-yellow-700 mt-2">R$ {totalSaldo.toFixed(2).replace(".", ",")}</p>
          <p className="text-yellow-600 font-bold text-lg">Saldo em Aberto</p>
        </div>
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔍  Buscar por nome ou CPF..."
          className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="col-span-4 text-xs font-black text-gray-400 uppercase tracking-widest">Cliente</p>
          <p className="col-span-3 text-xs font-black text-gray-400 uppercase tracking-widest">CPF</p>
          <p className="col-span-3 text-xs font-black text-gray-400 uppercase tracking-widest">Celular</p>
          <p className="col-span-2 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Saldo Atual</p>
        </div>

        <div className="divide-y divide-gray-50">
          {loading ? (
            <p className="text-center text-gray-400 font-semibold text-lg py-12">Carregando lista...</p>
          ) : clientes.length === 0 ? (
            <p className="text-center text-gray-400 font-semibold text-lg py-12">Nenhum cliente cadastrado ainda.</p>
          ) : (
            clientes.map((c) => (
              <div key={c.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-4">
                  <p className="font-black text-gray-900 text-lg">{c.cliente.nome}</p>
                  <p className="text-gray-400 text-xs font-bold uppercase">Cód: {c.codigo}</p>
                </div>
                <p className="col-span-3 text-gray-500 font-semibold text-base">
                  {c.cliente.cpf || <span className="text-gray-300 italic">—</span>}
                </p>
                <p className="col-span-3 text-gray-500 font-semibold text-base">
                  {c.cliente.celular || <span className="text-gray-300 italic">—</span>}
                </p>
                <p className={`col-span-2 font-black text-xl text-right ${c.saldo > 0 ? "text-green-600" : "text-gray-400"}`}>
                  R$ {c.saldo.toFixed(2).replace(".", ",")}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
