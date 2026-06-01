"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const labels = {
  CAIXA: { label: "Caixa Entrada", cor: "bg-green-100 text-green-700", emoji: "💳" },
  OPERADOR_BAR: { label: "Operador Bar/Food", cor: "bg-blue-100 text-blue-700", emoji: "🍺" },
};

export default function OperadoresPage() {
  const { data: session } = useSession();
  const [operadores, setOperadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [operadorEditando, setOperadorEditando] = useState(null);

  // Forms
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState("OPERADOR_BAR");
  const [salvando, setSalvando] = useState(false);

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
      carregarOperadores();
    }
  }, [eventoId]);

  const carregarOperadores = async () => {
    try {
      const res = await fetch(`/api/usuarios?eventoId=${eventoId}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setOperadores(data);
    } catch (e) {
      setError("Erro ao buscar lista de operadores");
    } finally {
      setLoading(false);
    }
  };

  const abrirCriar = () => {
    setOperadorEditando(null);
    setNome("");
    setEmail("");
    setSenha("");
    setRole("OPERADOR_BAR");
    setModalAberto(true);
  };

  const abrirEditar = (op) => {
    setOperadorEditando(op);
    setNome(op.nome);
    setEmail(op.email);
    setSenha(""); // Leave empty unless modifying password
    setRole(op.role);
    setModalAberto(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!nome || !email || !eventoId) return;
    setSalvando(true);
    setError("");

    const url = operadorEditando ? `/api/usuarios/${operadorEditando.id}` : "/api/usuarios";
    const method = operadorEditando ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          ...(senha && { senha }),
          role,
          eventoId
        })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setModalAberto(false);
        carregarOperadores();
      }
    } catch (err) {
      setError("Erro ao salvar operador");
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async (op) => {
    try {
      const res = await fetch(`/api/usuarios/${op.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !op.ativo })
      });
      if (res.ok) carregarOperadores();
    } catch (e) {
      console.error("Erro ao mudar status do operador", e);
    }
  };

  if (!eventoId) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-bold text-xl">Este usuário organizador não está vinculado a um evento.</p>
      </div>
    );
  }

  const ativos = operadores.filter((o) => o.ativo).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-4xl font-black text-[#1D3461]">Operadores</h2>
          <p className="text-gray-500 text-lg font-semibold mt-1">
            {ativos} operadores ativos neste evento
          </p>
        </div>
        <button
          onClick={abrirCriar}
          className="bg-[#1D3461] text-white font-black text-lg px-6 py-3 rounded-2xl hover:bg-blue-900 transition-all"
          style={{ minHeight: "52px" }}
        >
          + Novo Operador
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Cards por tipo */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-green-50 border-2 border-green-100 rounded-3xl p-5">
          <span className="text-4xl">💳</span>
          <p className="text-3xl font-black text-green-700 mt-2">
            {operadores.filter((o) => o.role === "CAIXA" && o.ativo).length}
          </p>
          <p className="text-green-600 font-bold text-lg">Caixas de Entrada</p>
        </div>
        <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-5">
          <span className="text-4xl">🍺</span>
          <p className="text-3xl font-black text-blue-700 mt-2">
            {operadores.filter((o) => o.role === "OPERADOR_BAR" && o.ativo).length}
          </p>
          <p className="text-blue-600 font-bold text-lg">Operadores de Bar/Food</p>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
        <div className="divide-y divide-gray-100">
          {loading ? (
            <p className="text-center text-gray-400 font-semibold text-lg py-12">Carregando operadores...</p>
          ) : operadores.length === 0 ? (
            <p className="text-center text-gray-400 font-semibold text-lg py-12">Nenhum operador cadastrado.</p>
          ) : (
            operadores.map((op) => {
              const tipo = labels[op.role] || { label: "Outro", cor: "bg-gray-100 text-gray-700", emoji: "👤" };
              return (
                <div key={op.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${!op.ativo ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${tipo.cor} shrink-0`}>
                      {tipo.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-gray-900 text-xl truncate">{op.nome}</p>
                      <p className="text-gray-500 font-semibold text-base truncate">{op.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${tipo.cor}`}>
                          {tipo.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => abrirEditar(op)}
                      className="px-4 py-2 rounded-2xl font-black text-base bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all flex items-center gap-1"
                      style={{ minHeight: "44px" }}
                    >
                      <span>✏️</span>
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                    <button
                      onClick={() => toggleAtivo(op)}
                      className={`px-4 py-2 rounded-2xl font-black text-base transition-all flex items-center gap-1 ${
                        op.ativo
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-red-50 text-red-500 hover:bg-red-100"
                      }`}
                      style={{ minHeight: "44px" }}
                    >
                      <span>{op.ativo ? "✅" : "❌"}</span>
                      <span className="hidden sm:inline">{op.ativo ? "Ativo" : "Inativo"}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: Novo/Editar Operador */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in duration-200">
            <h3 className="text-3xl font-black text-[#1D3461] mb-6">
              {operadorEditando ? "✏️ Editar Operador" : "➕ Novo Operador"}
            </h3>

            <form onSubmit={salvar} className="space-y-4">
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">E-mail *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">
                  Senha {operadorEditando && "(deixe em branco para não alterar)"} *
                </label>
                <input
                  type="password"
                  required={!operadorEditando}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Senha de acesso"
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">Função</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461] bg-white"
                  style={{ minHeight: "52px" }}
                >
                  <option value="OPERADOR_BAR">🍺 Operador de Bar/Food</option>
                  <option value="CAIXA">💳 Caixa de Entrada</option>
                </select>
              </div>

              <div className="flex gap-3 mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="flex-1 bg-gray-100 text-gray-700 font-black text-base py-4 rounded-2xl"
                  style={{ minHeight: "52px" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 bg-[#1D3461] text-white font-black text-base py-4 rounded-2xl disabled:opacity-40"
                  style={{ minHeight: "52px" }}
                >
                  {salvando ? "Salvando..." : "✅ Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
