"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const labels = {
  OPERADOR_BAR: { label: "Operador de Bar", cor: "bg-blue-100 text-blue-700", emoji: "🍺" },
  CAIXA: { label: "Caixa Fixo", cor: "bg-green-100 text-green-700", emoji: "💳" },
  CAIXA_VOLANTE: { label: "Caixa Volante", cor: "bg-yellow-100 text-yellow-700", emoji: "📱" },
  TESOURARIA: { label: "Tesouraria", cor: "bg-purple-100 text-purple-700", emoji: "💰" },
  SUPORTE_OPERACIONAL: { label: "Suporte Operacional", cor: "bg-teal-100 text-teal-700", emoji: "🛠️" },
  ORGANIZADOR: { label: "Produtor", cor: "bg-purple-100 text-purple-700", emoji: "🎯" },
};

export default function OperadoresPage() {
  const { data: session } = useSession();
  const [operadores, setOperadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [operadorEditando, setOperadorEditando] = useState(null);
  const [statusFiltro, setStatusFiltro] = useState("ativos"); // ativos | desativados | todos
  const [busca, setBusca] = useState("");

  // Form states
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [role, setRole] = useState("OPERADOR_BAR");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarOperadores();
  }, [session]);

  const carregarOperadores = async () => {
    try {
      let targetEventoId = null;
      if (session?.user?.role === "MASTER") {
        targetEventoId = typeof window !== "undefined" ? localStorage.getItem("activeEventoId") : null;
      } else {
        targetEventoId = session?.user?.eventoId || null;
      }

      let url = "/api/usuarios";
      if (targetEventoId) {
        url += `?eventoId=${targetEventoId}`;
      } else if (session?.user?.role !== "MASTER") {
        // Non-master with no event has no operators
        setOperadores([]);
        setLoading(false);
        return;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setOperadores(Array.isArray(data) ? data : []);
    } catch {
      setError("Erro ao carregar operadores");
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
    setNome(op.nome || "");
    setEmail(op.email || "");
    setSenha("");
    setMostrarSenha(false);
    setRole(op.role || "OPERADOR_BAR");
    setModalAberto(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const acaoMsg = operadorEditando
      ? `Você quer realmente confirmar as alterações no operador "${nome.trim()}"?`
      : `Você quer realmente incluir o operador "${nome.trim()}" (${labels[role]?.label || role}) no sistema?`;

    if (!window.confirm(acaoMsg)) return;

    setSalvando(true);
    setError("");

    const payload = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      role,
    };
    if (senha) payload.senha = senha.trim();

    const storedEventoId = localStorage.getItem("activeEventoId");
    if (session?.user?.role === "MASTER" && storedEventoId) {
      payload.eventoId = storedEventoId;
    }

    const url = operadorEditando ? `/api/usuarios/${operadorEditando.id}` : "/api/usuarios";
    const method = operadorEditando ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setModalAberto(false);
        carregarOperadores();
      } else {
        setError(data.error || "Erro ao salvar operador");
      }
    } catch {
      setError("Erro de conexão ao salvar operador");
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivoOperador = async (op) => {
    const novoStatus = !op.ativo;
    const msg = novoStatus
      ? `Você quer realmente REATIVAR o acesso do operador "${op.nome}"?`
      : `Você quer realmente DESATIVAR o operador "${op.nome}"?\n\nEle não conseguirá fazer login nos caixas/bares, mas todo o histórico e dados permanecerão salvos na aba Desativados.`;

    if (!window.confirm(msg)) return;

    try {
      const res = await fetch(`/api/usuarios/${op.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: novoStatus }),
      });
      if (res.ok) {
        carregarOperadores();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao alterar status");
      }
    } catch {
      alert("Erro de conexão ao alterar status");
    }
  };

  const handleExcluir = async (op) => {
    const confirmacao = window.confirm(
      `PERGUNTA FINAL DE CONFIRMAÇÃO:\n\nVocê quer realmente EXCLUIR permanentemente o operador "${op.nome}"?\n\nSe você só deseja pausar o acesso para o evento de hoje, use a opção "Desativar" para mantê-lo na aba Desativados.\n\nDeseja realmente excluir em definitivo?`
    );
    if (!confirmacao) return;

    try {
      const res = await fetch(`/api/usuarios/${op.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        carregarOperadores();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao excluir operador");
      }
    } catch {
      alert("Erro de conexão ao excluir operador");
    }
  };

  const totalAtivos = operadores.filter((o) => o.ativo).length;
  const totalDesativados = operadores.filter((o) => !o.ativo).length;

  const operadoresFiltrados = operadores
    .filter((o) => {
      if (statusFiltro === "ativos") return o.ativo;
      if (statusFiltro === "desativados") return !o.ativo;
      return true;
    })
    .filter((o) => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return (
        o.nome?.toLowerCase().includes(q) ||
        o.email?.toLowerCase().includes(q) ||
        o.role?.toLowerCase().includes(q)
      );
    });

  return (
    <div className="w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1D3461]">Operadores do Evento</h2>
          <p className="text-gray-500 text-xs sm:text-sm font-semibold">
            {totalAtivos} ativos · {totalDesativados} desativados · {operadores.length} no total
          </p>
        </div>
        <button
          onClick={abrirCriar}
          className="bg-[#1D3461] hover:bg-blue-900 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <span>➕</span> Novo Operador
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-3 rounded-xl mb-4 font-bold text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* Cards de resumo compacto */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-xl">💳</span>
            <p className="text-lg sm:text-xl font-black text-green-700">
              {operadores.filter((o) => (o.role === "CAIXA" || o.role === "TESOURARIA") && o.ativo).length}
            </p>
          </div>
          <p className="text-green-800 font-bold text-[11px] mt-1">Caixas / Tesouraria</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-xl">🍺</span>
            <p className="text-lg sm:text-xl font-black text-blue-700">
              {operadores.filter((o) => o.role === "OPERADOR_BAR" && o.ativo).length}
            </p>
          </div>
          <p className="text-blue-800 font-bold text-[11px] mt-1">Bares Ativos</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-xl">⏸️</span>
            <p className="text-lg sm:text-xl font-black text-amber-700">{totalDesativados}</p>
          </div>
          <p className="text-amber-800 font-bold text-[11px] mt-1">Desativados</p>
        </div>
      </div>

      {/* Abas de Status e Busca */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFiltro("ativos")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFiltro === "ativos"
                ? "bg-green-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>✅ Ativos</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFiltro === "ativos" ? "bg-white/20 text-white" : "bg-green-100 text-green-800"
            }`}>
              {totalAtivos}
            </span>
          </button>

          <button
            onClick={() => setStatusFiltro("desativados")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFiltro === "desativados"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>⏸️ Desativados</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFiltro === "desativados" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
            }`}>
              {totalDesativados}
            </span>
          </button>

          <button
            onClick={() => setStatusFiltro("todos")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFiltro === "todos"
                ? "bg-[#1D3461] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>📋 Todos</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFiltro === "todos" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
            }`}>
              {operadores.length}
            </span>
          </button>
        </div>

        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔍 Buscar operador..."
          className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#1D3461] sm:w-64"
        />
      </div>

      {statusFiltro === "desativados" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2.5">
          <span className="text-xl">⏸️</span>
          <div>
            <p className="font-bold text-amber-900 text-xs sm:text-sm">
              Ambiente de Operadores Desativados
            </p>
            <p className="text-amber-800 text-[11px] sm:text-xs font-medium mt-0.5">
              Operadores desativados não conseguem fazer login, mas seus históricos continuam salvos. Clique em <strong>&ldquo;✅ Reativar&rdquo;</strong> para liberar o acesso a qualquer momento.
            </p>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="divide-y divide-gray-100">
          {loading ? (
            <p className="text-center text-gray-400 font-semibold text-sm py-10">
              Carregando operadores...
            </p>
          ) : operadoresFiltrados.length === 0 ? (
            <div className="text-center py-10 px-4">
              <p className="text-gray-400 font-semibold text-sm">
                {statusFiltro === "desativados"
                  ? "Nenhum operador desativado no momento."
                  : "Nenhum operador encontrado nesta visualização."}
              </p>
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
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 sm:px-4 py-2.5 transition-colors border-b border-gray-50 last:border-0 ${
                    op.ativo ? "hover:bg-gray-50/70" : "bg-amber-50/30 hover:bg-amber-50/60"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${tipo.cor} shrink-0`}
                    >
                      {tipo.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-bold text-gray-900 text-sm truncate">
                          {op.nome}
                        </p>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            op.ativo
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {op.ativo ? "Ativo" : "Pausado"}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tipo.cor}`}>
                          {tipo.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 font-mono mt-0.5">
                        <span className="truncate">{op.email}</span>
                        {op.criadoPorNome && (
                          <span className="text-[10px] font-medium text-gray-400 font-sans">
                            • por {op.criadoPorNome}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 shrink-0 pt-1 sm:pt-0 border-t sm:border-0 border-gray-100">
                    <button
                      onClick={() => toggleAtivoOperador(op)}
                      className={`font-bold text-[11px] px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
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
                      className="font-bold text-[11px] px-2 py-1 rounded-lg transition-all border border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleExcluir(op)}
                      className="font-bold text-[11px] px-1.5 py-1 rounded-lg transition-all border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer whitespace-nowrap"
                      title="Excluir operador"
                    >
                      🗑️
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
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl animate-in fade-in duration-200">
            <h3 className="text-xl font-black text-[#1D3461] mb-4 pb-2 border-b border-gray-100">
              {operadorEditando ? "✏️ Editar Operador" : "➕ Novo Operador"}
            </h3>
            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3">
              {/* Decoy para impedir que o navegador/Chrome preencha automaticamente as credenciais salvas do usuário atual */}
              <input type="text" name="prevent_autofill_email_op" className="sr-only" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <input type="password" name="prevent_autofill_pwd_op" className="sr-only" tabIndex={-1} autoComplete="new-password" aria-hidden="true" />
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nome do Operador
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  E-mail (Login)
                </label>
                <input
                  type="email"
                  name="novo_operador_email_custom"
                  id="novo_operador_email_custom"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  required
                  value={email}
                  readOnly
                  onFocus={(e) => { e.currentTarget.readOnly = false; }}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@lamore.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {operadorEditando ? "Nova Senha (opcional)" : "Senha de Acesso"}
                </label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    name="novo_operador_senha_custom"
                    id="novo_operador_senha_custom"
                    autoComplete="new-password"
                    required={!operadorEditando}
                    value={senha}
                    readOnly
                    onFocus={(e) => { e.currentTarget.readOnly = false; }}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-10 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-sm cursor-pointer select-none"
                    title={mostrarSenha ? "Ocultar senha" : "Ver senha"}
                  >
                    {mostrarSenha ? "🙈" : "🔍"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Função no Evento
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1D3461] cursor-pointer"
                >
                  <option value="OPERADOR_BAR">🍺 Operador de Bar</option>
                  <option value="CAIXA">💳 Caixa Fixo</option>
                  <option value="CAIXA_VOLANTE">📱 Caixa Volante</option>
                  <option value="TESOURARIA">💰 Tesouraria</option>
                  <option value="SUPORTE_OPERACIONAL">🛠️ Suporte Operacional</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 bg-[#1D3461] hover:bg-blue-900 text-white font-bold py-2.5 rounded-xl transition-all text-xs disabled:opacity-50 cursor-pointer"
                >
                  {salvando ? "Salvando..." : "Salvar Operador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
