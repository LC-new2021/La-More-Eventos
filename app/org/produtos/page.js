"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function ProdutosPage() {
  const { data: session } = useSession();
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [aba, setAba] = useState("produtos"); // produtos | pagamentos
  const [grupoFiltro, setGrupoFiltro] = useState("todos");

  // Modais
  const [modalProduto, setModalProduto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState(null);

  // Forms
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [grupo, setGrupo] = useState("Bebidas");
  const [novoGrupo, setNovoGrupo] = useState("");
  const [mostrarNovoGrupoInput, setMostrarNovoGrupoInput] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Pagamentos Customizados
  const [pagamentosConfig, setPagamentosConfig] = useState([]);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [pgLabel, setPgLabel] = useState("");
  const [pgEmoji, setPgEmoji] = useState("💳");
  const [pgDesc, setPgDesc] = useState("");
  const [pgTroco, setPgTroco] = useState(false);
  const [salvandoPg, setSalvandoPg] = useState(false);

  // Extracted unique groups from products list
  const grupos = [...new Set(["Bebidas", "Food", "Sobremesas", "Outros", ...produtos.map((p) => p.grupo).filter(Boolean)])];

  const eventoId = session?.user?.eventoId;

  useEffect(() => {
    if (eventoId) {
      carregarProdutos();
      carregarEvento();
    }
  }, [eventoId]);

  const carregarEvento = async () => {
    try {
      const res = await fetch(`/api/eventos/${eventoId}`);
      const data = await res.json();
      if (!data.error) {
        if (data.metodosPagamentoJson) {
          setPagamentosConfig(JSON.parse(data.metodosPagamentoJson));
        } else {
          const defaultPgs = [
            { id: "pix", label: "Pix", emoji: "🟢", ativo: true, descricao: "Chave Pix gerada pelo caixa — confirmação manual pelo operador" },
            { id: "cartao", label: "Cartão de Crédito/Débito", emoji: "💳", ativo: true, descricao: "Integrado via POS/Maquininha física ou manual" },
            { id: "dinheiro", label: "Dinheiro", emoji: "💵", ativo: true, descricao: "Dinheiro em espécie (com calculadora de troco no caixa)", troco: true },
          ];
          setPagamentosConfig(defaultPgs);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar configurações de pagamento", e);
    }
  };

  const salvarMetodosPagamento = async (novosMetodos) => {
    setSalvandoPg(true);
    try {
      const res = await fetch(`/api/eventos/${eventoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metodosPagamentoJson: JSON.stringify(novosMetodos) }),
      });
      if (res.ok) {
        setPagamentosConfig(novosMetodos);
      }
    } catch (e) {
      console.error("Erro ao salvar métodos de pagamento", e);
    } finally {
      setSalvandoPg(false);
    }
  };

  const carregarProdutos = async () => {
    try {
      const res = await fetch(`/api/produtos?eventoId=${eventoId}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setProdutos(data);
    } catch (e) {
      setError("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const abrirNovoProduto = () => {
    setProdutoEditando(null);
    setNome("");
    setPreco("");
    setGrupo("Bebidas");
    setNovoGrupo("");
    setMostrarNovoGrupoInput(false);
    setModalProduto(true);
  };

  const abrirEditarProduto = (p) => {
    setProdutoEditando(p);
    setNome(p.nome);
    setPreco(p.preco.toString());
    setGrupo(p.grupo);
    setNovoGrupo("");
    setMostrarNovoGrupoInput(false);
    setModalProduto(true);
  };

  const salvarProduto = async (e) => {
    e.preventDefault();
    if (!nome || !preco || !eventoId) return;
    setSalvando(true);
    setError("");

    const grupoFinal = mostrarNovoGrupoInput && novoGrupo.trim() ? novoGrupo.trim() : grupo;
    const url = produtoEditando ? `/api/produtos/${produtoEditando.id}` : "/api/produtos";
    const method = produtoEditando ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          preco: parseFloat(preco),
          grupo: grupoFinal,
          eventoId
        })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setModalProduto(false);
        carregarProdutos();
      }
    } catch (err) {
      setError("Erro ao salvar produto");
    } finally {
      setSalvando(false);
    }
  };

  const excluirProduto = async (id) => {
    if (!confirm("Excluir este produto?")) return;
    try {
      const res = await fetch(`/api/produtos/${id}`, { method: "DELETE" });
      if (res.ok) carregarProdutos();
    } catch (e) {
      console.error("Erro ao deletar produto", e);
    }
  };

  const toggleAtivoProduto = async (p) => {
    try {
      const res = await fetch(`/api/produtos/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !p.ativo })
      });
      if (res.ok) carregarProdutos();
    } catch (e) {
      console.error("Erro ao mudar status do produto", e);
    }
  };

  const produtosFiltrados =
    grupoFiltro === "todos"
      ? produtos
      : produtos.filter((p) => p.grupo === grupoFiltro);

  if (!eventoId) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-bold text-xl">Este usuário organizador não está vinculado a um evento.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-4xl font-black text-[#1D3461]">Cardápio & Pagamentos</h2>
          <p className="text-gray-500 text-lg font-semibold mt-1">
            {aba === "produtos" 
              ? `${produtos.filter((p) => p.ativo).length} produtos ativos · ${grupos.length} grupos`
              : `${pagamentosConfig.filter((p) => p.ativo).length} métodos ativos`
            }
          </p>
        </div>
        {aba === "produtos" && (
          <button onClick={abrirNovoProduto} className="bg-[#1D3461] text-white font-black text-lg px-6 py-3 rounded-2xl hover:bg-blue-900 transition-all" style={{ minHeight: "52px" }}>
            + Novo Produto
          </button>
        )}
        {aba === "pagamentos" && (
          <button onClick={() => {
            setPgLabel("");
            setPgEmoji("💳");
            setPgDesc("");
            setPgTroco(false);
            setModalPagamento(true);
          }} className="bg-[#1D3461] text-white font-black text-lg px-6 py-3 rounded-2xl hover:bg-blue-900 transition-all" style={{ minHeight: "52px" }}>
            + Novo Método
          </button>
        )}
      </div>

      {/* ABAS */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-2xl w-fit">
        {[
          { id: "produtos", label: "🍺 Cardápio de Produtos" },
          { id: "pagamentos", label: "💳 Métodos de Pagamento" },
        ].map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`px-5 py-3 rounded-xl font-black text-base transition-all ${
              aba === a.id ? "bg-white text-[#1D3461] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
            style={{ minHeight: "52px" }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* ABA: PRODUTOS */}
      {aba === "produtos" && (
        <>
          {/* Filtro por grupo */}
          <div className="flex gap-3 mb-5 overflow-x-auto pb-1">
            <button
              onClick={() => setGrupoFiltro("todos")}
              className={`px-5 py-3 rounded-2xl font-black text-base whitespace-nowrap transition-all ${grupoFiltro === "todos" ? "bg-[#1D3461] text-white" : "bg-white text-gray-600 border-2 border-gray-100"}`}
              style={{ minHeight: "52px" }}
            >
              Todos
            </button>
            {grupos.map((g) => (
              <button
                key={g}
                onClick={() => setGrupoFiltro(g)}
                className={`px-5 py-3 rounded-2xl font-black text-base whitespace-nowrap transition-all ${grupoFiltro === g ? "bg-[#1D3461] text-white" : "bg-white text-gray-600 border-2 border-gray-100"}`}
                style={{ minHeight: "52px" }}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-100">
              {loading ? (
                <p className="text-center text-gray-400 font-semibold text-lg py-12">Carregando cardápio...</p>
              ) : produtosFiltrados.length === 0 ? (
                <p className="text-center text-gray-400 font-semibold text-lg py-12">Nenhum produto cadastrado.</p>
              ) : (
                produtosFiltrados.map((p) => (
                  <div key={p.id} className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors ${!p.ativo ? "opacity-50" : ""}`}>
                    <span className="text-3xl">📦</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 text-xl">{p.nome}</p>
                      <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-0.5 rounded-full">
                        {p.grupo}
                      </span>
                    </div>
                    <p className="font-black text-[#1D3461] text-2xl w-32 text-right">
                      R$ {p.preco.toFixed(2).replace(".", ",")}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAtivoProduto(p)}
                        className={`px-4 py-2 rounded-2xl font-black text-base transition-all ${p.ativo ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-50 text-red-500 hover:bg-red-100"}`}
                        style={{ minHeight: "44px" }}
                      >
                        {p.ativo ? "✅ Ativo" : "❌ Inativo"}
                      </button>
                      <button
                        onClick={() => abrirEditarProduto(p)}
                        className="px-4 py-2 rounded-2xl font-black text-base bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                        style={{ minHeight: "44px" }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => excluirProduto(p.id)}
                        className="px-4 py-2 rounded-2xl font-black text-base bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                        style={{ minHeight: "44px" }}
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* ABA: PAGAMENTOS */}
      {aba === "pagamentos" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-5 mb-6 font-semibold">
            <p className="font-black text-blue-800 text-lg">ℹ️ Métodos de Pagamento do Evento</p>
            <p className="text-blue-700 text-base mt-1">
              Configure as formas de pagamento aceitas na bilheteria para emissão de cartões. Todas as alterações serão espelhadas automaticamente nos caixas (POS).
            </p>
          </div>

          {pagamentosConfig.map((pg) => (
            <div key={pg.id} className={`bg-white rounded-3xl border-2 p-6 flex items-start gap-5 transition-all ${pg.ativo ? "border-gray-100" : "border-gray-100 opacity-50 bg-gray-50"}`}>
              <span className="text-5xl">{pg.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-gray-900 text-2xl">{pg.label}</p>
                  {pg.troco && <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">💵 Admite Troco</span>}
                </div>
                <p className="text-gray-500 font-semibold text-base mt-1">{pg.descricao}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const novos = pagamentosConfig.map(p => p.id === pg.id ? { ...p, ativo: !p.ativo } : p);
                    salvarMetodosPagamento(novos);
                  }}
                  disabled={salvandoPg}
                  className={`px-4 py-2 rounded-2xl font-black text-base transition-all ${pg.ativo ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-50 text-red-500 hover:bg-red-100"}`}
                  style={{ minHeight: "44px" }}
                >
                  {pg.ativo ? "✅ Ativo" : "❌ Inativo"}
                </button>
                {pg.id !== "pix" && pg.id !== "cartao" && pg.id !== "dinheiro" && (
                  <button
                    onClick={() => {
                      if (confirm("Excluir este método de pagamento?")) {
                        const novos = pagamentosConfig.filter(p => p.id !== pg.id);
                        salvarMetodosPagamento(novos);
                      }
                    }}
                    disabled={salvandoPg}
                    className="px-4 py-2 rounded-2xl font-black text-base bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                    style={{ minHeight: "44px" }}
                  >
                    🗑️ Excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: PRODUTO */}
      {modalProduto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in duration-200">
            <h3 className="text-3xl font-black text-[#1D3461] mb-6">
              {produtoEditando ? "✏️ Editar Produto" : "➕ Novo Produto"}
            </h3>
            <form onSubmit={salvarProduto} className="space-y-4">
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">Nome do Produto *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Heineken 600ml"
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">Preço (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="0,00"
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">Grupo/Categoria *</label>
                <select
                  value={mostrarNovoGrupoInput ? "novo" : grupo}
                  onChange={(e) => {
                    if (e.target.value === "novo") {
                      setMostrarNovoGrupoInput(true);
                    } else {
                      setMostrarNovoGrupoInput(false);
                      setGrupo(e.target.value);
                    }
                  }}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461] bg-white"
                  style={{ minHeight: "52px" }}
                >
                  {grupos.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  <option value="novo">+ Criar Novo Grupo...</option>
                </select>

                {mostrarNovoGrupoInput && (
                  <input
                    type="text"
                    required
                    value={novoGrupo}
                    onChange={(e) => setNovoGrupo(e.target.value)}
                    placeholder="Nome do novo grupo (ex: Doses)"
                    className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461] mt-3"
                  />
                )}
              </div>

              <div className="flex gap-3 mt-8 pt-4">
                <button type="button" onClick={() => setModalProduto(false)} className="flex-1 bg-gray-100 text-gray-700 font-black text-base py-4 rounded-2xl" style={{ minHeight: "52px" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="flex-1 bg-[#1D3461] text-white font-black text-base py-4 rounded-2xl disabled:opacity-40" style={{ minHeight: "52px" }}>
                  {salvando ? "Salvando..." : "✅ Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: PAGAMENTO */}
      {modalPagamento && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in duration-200">
            <h3 className="text-3xl font-black text-[#1D3461] mb-6">
              ➕ Novo Método de Pagamento
            </h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!pgLabel.trim()) return;
              const newId = "custom_" + Date.now();
              const novos = [
                ...pagamentosConfig,
                { id: newId, label: pgLabel.trim(), emoji: pgEmoji, descricao: pgDesc.trim(), ativo: true, troco: pgTroco }
              ];
              salvarMetodosPagamento(novos);
              setModalPagamento(false);
            }} className="space-y-4">
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">Nome do Método *</label>
                <input
                  type="text"
                  required
                  value={pgLabel}
                  onChange={(e) => setPgLabel(e.target.value)}
                  placeholder="Ex: PicPay, Vale Refeição"
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-gray-700 text-base mb-2">Emoji/Ícone</label>
                  <input
                    type="text"
                    value={pgEmoji}
                    onChange={(e) => setPgEmoji(e.target.value)}
                    placeholder="Ex: 💵, 📱, 🟢"
                    className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                  />
                </div>
                <div className="flex items-center justify-center pt-8">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={pgTroco}
                      onChange={(e) => setPgTroco(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-[#1D3461] focus:ring-[#1D3461]"
                    />
                    <span className="font-bold text-gray-700 text-base">Admite Troco</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">Descrição *</label>
                <textarea
                  required
                  value={pgDesc}
                  onChange={(e) => setPgDesc(e.target.value)}
                  placeholder="Instruções para o operador de caixa..."
                  rows={3}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>

              <div className="flex gap-3 mt-8 pt-4">
                <button type="button" onClick={() => setModalPagamento(false)} className="flex-1 bg-gray-100 text-gray-700 font-black text-base py-4 rounded-2xl" style={{ minHeight: "52px" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvandoPg} className="flex-1 bg-[#1D3461] text-white font-black text-base py-4 rounded-2xl disabled:opacity-40" style={{ minHeight: "52px" }}>
                  {salvandoPg ? "Salvando..." : "✅ Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
