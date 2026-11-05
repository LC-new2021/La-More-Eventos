"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const labels = {
  CAIXA: { label: "Caixa Entrada", cor: "bg-green-100 text-green-700", emoji: "💳" },
  CAIXA_VOLANTE: { label: "Caixa Volante", cor: "bg-green-100 text-green-700", emoji: "💳" },
  OPERADOR_BAR: { label: "Operador Bar/Food", cor: "bg-blue-100 text-blue-700", emoji: "🍺" },
  TESOURARIA: { label: "Tesouraria (Acesso Multi)", cor: "bg-purple-100 text-purple-700", emoji: "💵" },
  SUPORTE_OPERACIONAL: { label: "Suporte Operacional", cor: "bg-teal-100 text-teal-700", emoji: "🛠️" },
  CLIENTE: { label: "Suporte Operacional", cor: "bg-teal-100 text-teal-700", emoji: "🛠️" },
  SUPORTE: { label: "Suporte Operacional", cor: "bg-teal-100 text-teal-700", emoji: "🛠️" },
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
        if (session.user.eventoId) {
          setEventoId(session.user.eventoId);
        } else {
          const stored = localStorage.getItem("activeEventoId");
          if (stored) {
            setEventoId(stored);
          } else {
            fetch("/api/eventos")
              .then((res) => res.json())
              .then((data) => {
                if (data && data.length > 0 && !data.error) {
                  localStorage.setItem("activeEventoId", data[0].id);
                  setEventoId(data[0].id);
                }
              })
              .catch(console.error);
          }
        }
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
    setError("");
    setOperadorEditando(null);
    setNome("");
    setEmail("");
    setSenha("");
    setRole("OPERADOR_BAR");
    setModalAberto(true);
  };

  const abrirEditar = (op) => {
    setError("");
    setOperadorEditando(op);
    setNome(op.nome);
    setEmail(op.email);
    setSenha(""); // Leave empty unless modifying password
    let userRole = op.role;
    if (userRole === 'CLIENTE' || userRole === 'SUPORTE') userRole = 'SUPORTE_OPERACIONAL';
    setRole(userRole);
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
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          ...(senha && { senha: senha.trim() }),
          role,
          eventoId
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Erro ao salvar operador.");
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

  const handleExcluir = async (id) => {
    if (!window.confirm("ATENÇÃO: Tem certeza que deseja excluir permanentemente este operador?")) return;
    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: "DELETE"
      });
      if (res.ok) carregarOperadores();
    } catch (e) {
      console.error("Erro ao excluir operador", e);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h2 className="text-2xl sm:text-4xl font-black text-[#1D3461]">Operadores</h2>
          <p className="text-gray-500 text-sm sm:text-lg font-semibold mt-1">
            {ativos} operadores ativos neste evento
          </p>
        </div>
        <button
          onClick={abrirCriar}
          className="w-full sm:w-auto bg-[#1D3461] text-white font-black text-base sm:text-lg px-6 py-3 rounded-2xl hover:bg-blue-900 transition-all"
          style={{ minHeight: "48px" }}
        >
          + Novo Operador
        </button>
      </div>

      {error && !modalAberto && (
        <div className="bg-red-50 border-2 border-red-300 text-red-700 p-4 rounded-2xl mb-6 font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Cards por tipo */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-green-50 border-2 border-green-100 rounded-3xl p-4 sm:p-5">
          <span className="text-3xl sm:text-4xl">💳</span>
          <p className="text-2xl sm:text-3xl font-black text-green-700 mt-1.5 sm:mt-2">
            {operadores.filter((o) => (o.role === "CAIXA" || o.role === "CAIXA_VOLANTE") && o.ativo).length}
          </p>
          <p className="text-green-600 font-bold text-sm sm:text-lg leading-tight">Caixas de Entrada</p>
        </div>
        <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-4 sm:p-5">
          <span className="text-3xl sm:text-4xl">🍺</span>
          <p className="text-2xl sm:text-3xl font-black text-blue-700 mt-1.5 sm:mt-2">
            {operadores.filter((o) => o.role === "OPERADOR_BAR" && o.ativo).length}
          </p>
          <p className="text-blue-600 font-bold text-sm sm:text-lg leading-tight">Operadores de Bar/Food</p>
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
                <div key={op.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-4 sm:py-5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${!op.ativo ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-xl sm:text-2xl ${tipo.cor} shrink-0`}>
                      {tipo.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-gray-900 text-base sm:text-xl truncate">{op.nome}</p>
                      <p className="text-gray-500 font-semibold text-xs sm:text-base truncate">{op.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[11px] sm:text-xs font-black px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full ${tipo.cor}`}>
                          {tipo.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
                    <button
                      onClick={() => abrirEditar(op)}
                      className="font-bold text-xs sm:text-sm px-3.5 sm:px-4 py-2 rounded-xl transition-all border-2 text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleExcluir(op.id)}
                      className="font-bold text-xs sm:text-sm px-3.5 sm:px-4 py-2 rounded-xl transition-all border-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                    >
                      🗑️ Excluir
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in duration-200 scrollbar-thin">
            <h3 className="text-2xl sm:text-3xl font-black text-[#1D3461] mb-4 sticky top-0 bg-white pb-2 z-10">
              {operadorEditando ? "✏️ Editar Operador" : "➕ Novo Operador"}
            </h3>

            {error && (
              <div className="bg-red-50 border-2 border-red-300 text-red-700 p-3.5 rounded-2xl mb-4 font-bold text-sm flex items-start gap-2 animate-in fade-in duration-150">
                <span className="shrink-0">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={salvar} className="space-y-4">
              <div>
                <label className="block font-black text-gray-700 text-sm sm:text-base mb-1.5">Nome *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 sm:px-5 py-3 text-base sm:text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>
              <div>
                <label className="block font-black text-gray-700 text-sm sm:text-base mb-1.5">E-mail *</label>
                <input
                  type="email"
                  required
                  value={email}
                  autoComplete="off"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 sm:px-5 py-3 text-base sm:text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>
              <div>
                <label className="block font-black text-gray-700 text-sm sm:text-base mb-1.5">
                  Senha {operadorEditando && "(deixe em branco para não alterar)"} *
                </label>
                <input
                  type="password"
                  required={!operadorEditando}
                  value={senha}
                  autoComplete="new-password"
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Senha de acesso"
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 sm:px-5 py-3 text-base sm:text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>
              <div>
                <label className="block font-black text-gray-700 text-sm sm:text-base mb-1.5">Função</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={operadorEditando && session?.user?.id === operadorEditando.id}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 sm:px-5 py-3 text-base sm:text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461] bg-white disabled:bg-gray-100 disabled:text-gray-500"
                  style={{ minHeight: "48px" }}
                >
                  {operadorEditando?.role === 'ORGANIZADOR' && (
                    <option value="ORGANIZADOR">👑 Organizador</option>
                  )}
                  <option value="OPERADOR_BAR">🍺 Operador de Bar/Food</option>
                  <option value="CAIXA">💳 Caixa de Entrada (Sem Dinheiro)</option>
                  <option value="TESOURARIA">💵 Tesouraria (Acesso Multi)</option>
                  <option value="SUPORTE_OPERACIONAL">🛠️ Suporte Operacional</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-300 text-red-700 p-3.5 rounded-2xl font-bold text-sm flex items-start gap-2">
                  <span className="shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => { setError(""); setModalAberto(false); }}
                  className="flex-1 bg-gray-100 text-gray-700 font-black text-base py-3.5 rounded-2xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 bg-[#1D3461] text-white font-black text-base py-3.5 rounded-2xl disabled:opacity-40"
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
