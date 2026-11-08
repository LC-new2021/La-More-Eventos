"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const labels = {
  ORGANIZADOR: { label: "Organizador", cor: "bg-indigo-100 text-indigo-700", emoji: "👑" },
  CAIXA: { label: "Caixa Entrada", cor: "bg-green-100 text-green-700", emoji: "💳" },
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
  const [statusFiltro, setStatusFiltro] = useState("ativos"); // ativos | desativados | todos
  const [busca, setBusca] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [operadorEditando, setOperadorEditando] = useState(null);

  // Forms
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [role, setRole] = useState("OPERADOR_BAR");
  const [salvando, setSalvando] = useState(false);

  const [eventoId, setEventoId] = useState(null);

  useEffect(() => {
    if (session) {
      if (session.user.role === "MASTER") {
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
      else setOperadores(Array.isArray(data) ? data : []);
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
    setMostrarSenha(false);
    setRole("OPERADOR_BAR");
    setModalAberto(true);
  };

  const abrirEditar = (op) => {
    setOperadorEditando(op);
    setNome(op.nome);
    setEmail(op.email);
    setSenha("");
    setMostrarSenha(false);
    setRole(op.role);
    setModalAberto(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!nome || !email || !eventoId) return;

    const msgConfirm = operadorEditando
      ? `Você quer realmente confirmar as alterações no operador "${nome.trim()}"?`
      : `Você quer realmente incluir o operador "${nome.trim()}" neste evento?`;

    if (!window.confirm(msgConfirm)) return;

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
          eventoId,
        }),
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

  const toggleAtivoOperador = async (op) => {
    if (op.id === session?.user?.id && op.ativo) {
      alert("Você não pode desativar o seu próprio usuário conectado.");
      return;
    }
    try {
      const res = await fetch(`/api/usuarios/${op.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !op.ativo }),
      });
      if (res.ok) carregarOperadores();
      else {
        const err = await res.json();
        if (err?.error) alert(err.error);
      }
    } catch (e) {
      console.error("Erro ao alterar status do operador", e);
    }
  };

  const handleExcluir = async (op) => {
    if (op.id === session?.user?.id) {
      alert("Você não pode excluir o seu próprio usuário conectado.");
      return;
    }
    const confirmou = window.confirm(
      `⚠️ CONFIRMAÇÃO DE EXCLUSÃO\n\nVocê quer realmente cancelar/excluir o operador "${op.nome}" (${op.email})?\n\n💡 Dica: Se quiser apenas bloquear o acesso temporariamente e poder reativar depois, clique em "Cancelar" e use o botão "Desativar".\n\nDeseja realmente EXCLUIR este operador definitivamente? (As operações já realizadas permanecerão salvas nos relatórios)`
    );
    if (!confirmou) return;

    try {
      const res = await fetch(`/api/usuarios/${op.id}`, {
        method: "DELETE",
      });
      if (res.ok) carregarOperadores();
    } catch (e) {
      console.error("Erro ao excluir operador", e);
    }
  };

  if (!eventoId) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-bold text-xl">
          Este usuário não está vinculado a um evento.
        </p>
      </div>
    );
  }

  const totalAtivos = operadores.filter((o) => o.ativo).length;
  const totalDesativados = operadores.filter((o) => !o.ativo).length;

  const operadoresFiltrados = operadores
    .filter((o) => {
      if (statusFiltro === "ativos") return o.ativo === true;
      if (statusFiltro === "desativados") return o.ativo === false;
      return true;
    })
    .filter((o) => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return (
        String(o.nome || "").toLowerCase().includes(q) ||
        String(o.email || "").toLowerCase().includes(q) ||
        String(o.role || "").toLowerCase().includes(q)
      );
    });

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#1D3461]">Operadores</h2>
          <p className="text-gray-500 text-base sm:text-lg font-semibold mt-1">
            {totalAtivos} ativos · {totalDesativados} desativados neste evento
          </p>
        </div>
        <button
          onClick={abrirCriar}
          className="bg-[#1D3461] text-white font-black text-base sm:text-lg px-6 py-3 rounded-2xl hover:bg-blue-900 transition-all"
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border-2 border-green-100 rounded-3xl p-5">
          <span className="text-3xl sm:text-4xl">💳</span>
          <p className="text-2xl sm:text-3xl font-black text-green-700 mt-2">
            {operadores.filter((o) => (o.role === "CAIXA" || o.role === "TESOURARIA") && o.ativo).length}
          </p>
          <p className="text-green-600 font-bold text-sm sm:text-base">Caixas / Tesouraria Ativos</p>
        </div>
        <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-5">
          <span className="text-3xl sm:text-4xl">🍺</span>
          <p className="text-2xl sm:text-3xl font-black text-blue-700 mt-2">
            {operadores.filter((o) => o.role === "OPERADOR_BAR" && o.ativo).length}
          </p>
          <p className="text-blue-600 font-bold text-sm sm:text-base">Operadores de Bar Ativos</p>
        </div>
        <div className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-5 col-span-2 sm:col-span-1">
          <span className="text-3xl sm:text-4xl">⏸️</span>
          <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-2">{totalDesativados}</p>
          <p className="text-amber-700 font-bold text-sm sm:text-base">Operadores Desativados</p>
        </div>
      </div>

      {/* Abas de Status: Ativos vs Desativados */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border-2 border-gray-100 shadow-sm">
          <button
            onClick={() => setStatusFiltro("ativos")}
            className={`px-4 py-2.5 rounded-xl font-black text-sm sm:text-base transition-all flex items-center gap-2 ${
              statusFiltro === "ativos"
                ? "bg-green-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span>✅ Operadores Ativos</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                statusFiltro === "ativos"
                  ? "bg-white/20 text-white"
                  : "bg-green-100 text-green-800"
              }`}
            >
              {totalAtivos}
            </span>
          </button>

          <button
            onClick={() => setStatusFiltro("desativados")}
            className={`px-4 py-2.5 rounded-xl font-black text-sm sm:text-base transition-all flex items-center gap-2 ${
              statusFiltro === "desativados"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span>⏸️ Operadores Desativados</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                statusFiltro === "desativados"
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {totalDesativados}
            </span>
          </button>

          <button
            onClick={() => setStatusFiltro("todos")}
            className={`px-4 py-2.5 rounded-xl font-black text-sm sm:text-base transition-all flex items-center gap-2 ${
              statusFiltro === "todos"
                ? "bg-[#1D3461] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span>📋 Todos</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                statusFiltro === "todos"
                  ? "bg-white/20 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {operadores.length}
            </span>
          </button>
        </div>

        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔍 Buscar operador..."
          className="bg-white border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#1D3461]"
        />
      </div>

      {statusFiltro === "desativados" && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <span className="text-2xl">⏸️</span>
          <div>
            <p className="font-black text-amber-900 text-sm sm:text-base">
              Ambiente de Operadores Desativados
            </p>
            <p className="text-amber-800 text-xs sm:text-sm font-semibold mt-0.5">
              Operadores desativados não conseguem fazer login no sistema, mas seus cadastros e históricos permanecem salvos. Clique em <strong>&ldquo;✅ Reativar&rdquo;</strong> para liberar o acesso novamente a qualquer momento.
            </p>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
        <div className="divide-y divide-gray-100">
          {loading ? (
            <p className="text-center text-gray-400 font-semibold text-lg py-12">
              Carregando operadores...
            </p>
          ) : operadoresFiltrados.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-gray-400 font-semibold text-lg">
                {statusFiltro === "desativados"
                  ? "Nenhum operador desativado no momento."
                  : "Nenhum operador encontrado nesta visualização."}
              </p>
              {statusFiltro === "ativos" && totalDesativados > 0 && (
                <button
                  onClick={() => setStatusFiltro("desativados")}
                  className="mt-3 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-4 py-2 rounded-xl font-black text-sm transition-all"
                >
                  Ver {totalDesativados} operador(es) na aba Desativados →
                </button>
              )}
            </div>
          ) : (
            operadoresFiltrados.map((op) => {
              const tipo = labels[op.role] || {
                label: op.role || "Outro",
                cor: "bg-gray-100 text-gray-700",
                emoji: "👤",
              };
              return (
                <div
                  key={op.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 sm:px-6 py-5 transition-colors border-b border-gray-100 last:border-0 ${
                    op.ativo ? "hover:bg-gray-50" : "bg-amber-50/40 hover:bg-amber-50/70"
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${tipo.cor} shrink-0`}
                    >
                      {tipo.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-gray-900 text-lg sm:text-xl truncate">
                          {op.nome}
                        </p>
                        <span
                          className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            op.ativo
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-200 text-amber-900"
                          }`}
                        >
                          {op.ativo ? "Ativo" : "Desativado"}
                        </span>
                      </div>
                      <p className="text-gray-500 font-semibold text-sm sm:text-base truncate">
                        {op.email}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${tipo.cor}`}>
                          {tipo.label}
                        </span>
                        {op.criadoPorNome && (
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                            👤 Criado por {op.criadoPorNome}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    <button
                      onClick={() => toggleAtivoOperador(op)}
                      className={`font-black text-sm px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                        op.ativo
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                      }`}
                    >
                      <span>{op.ativo ? "⏸️" : "✅"}</span>
                      <span>{op.ativo ? "Desativar" : "Reativar"}</span>
                    </button>
                    <button
                      onClick={() => abrirEditar(op)}
                      className="font-bold text-sm px-3.5 py-2 rounded-xl transition-all border-2 text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleExcluir(op)}
                      className="font-bold text-sm px-3.5 py-2 rounded-xl transition-all border-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl animate-in fade-in duration-200">
            <h3 className="text-2xl sm:text-3xl font-black text-[#1D3461] mb-6">
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
                  autoComplete="off"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">
                  Senha {operadorEditando && "(deixe em branco para não alterar)"} *
                </label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    required={!operadorEditando}
                    value={senha}
                    autoComplete="new-password"
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Senha de acesso"
                    className="w-full border-2 border-gray-200 rounded-2xl pl-5 pr-14 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((prev) => !prev)}
                    title={mostrarSenha ? "Ocultar senha" : "Visualizar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg"
                  >
                    {mostrarSenha ? "🙈" : "🔍"}
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">Função</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={operadorEditando && session?.user?.id === operadorEditando.id}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461] bg-white disabled:bg-gray-100 disabled:text-gray-500"
                  style={{ minHeight: "52px" }}
                >
                  {operadorEditando?.role === "ORGANIZADOR" && (
                    <option value="ORGANIZADOR">👑 Organizador</option>
                  )}
                  <option value="OPERADOR_BAR">🍺 Operador de Bar/Food</option>
                  <option value="CAIXA">💳 Caixa de Entrada (Sem Dinheiro)</option>
                  <option value="TESOURARIA">💵 Tesouraria (Acesso Multi)</option>
                  <option value="SUPORTE_OPERACIONAL">🛠️ Suporte Operacional</option>
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
