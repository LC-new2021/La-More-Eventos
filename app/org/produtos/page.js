"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

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

  // Importar Planilha
  const [modalImportar, setModalImportar] = useState(false);
  const [produtosParaImportar, setProdutosParaImportar] = useState([]);
  const [importando, setImportando] = useState(false);

  // Forms
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [grupo, setGrupo] = useState("Bebidas");
  const [imagem, setImagem] = useState("📦");
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

  // Gateway config states
  const [gatewayActive, setGatewayActive] = useState("ASAAS");
  const [asaasToken, setAsaasToken] = useState("");
  const [asaasUrl, setAsaasUrl] = useState("");
  const [pagbankToken, setPagbankToken] = useState("");
  const [pagbankKey, setPagbankKey] = useState("");
  const [salvandoGateway, setSalvandoGateway] = useState(false);
  const [sucessoGateway, setSucessoGateway] = useState("");

  // Extracted unique groups from products list
  const grupos = [...new Set(["Bebidas", "Food", "Sobremesas", "Outros", ...produtos.map((p) => p.grupo).filter(Boolean)])];

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
    if (session?.user?.id) {
      fetch(`/api/usuarios/${session.user.id}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setGatewayActive(data.gatewayActive || "ASAAS");
            setAsaasToken(data.asaasToken || "");
            setAsaasUrl(data.asaasUrl || "");
            setPagbankToken(data.pagbankToken || "");
            setPagbankKey(data.pagbankKey || "");
          }
        })
        .catch(console.error);
    }
  }, [session]);

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

  const baixarTemplateExcel = () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Modelo de Produtos");
    sheet.addRow(["Nome", "Preço", "Categoria", "Ícone (Emoji)"]);
    sheet.addRow(["Heineken 600ml", 18.00, "Bebidas", "🍺"]);
    sheet.addRow(["Hambúrguer Gourmet", 35.50, "Food", "🍔"]);
    sheet.addRow(["Batata Frita", 20.00, "Food", "🍟"]);
    sheet.addRow(["Coca-Cola Lata", 8.00, "Bebidas", "🥤"]);
    sheet.addRow(["Água Mineral", 5.00, "Bebidas", "🥤"]);
    sheet.addRow(["Sorvete de Casquinha", 12.00, "Sobremesas", "🍦"]);
    
    sheet.columns = [
      { width: 25 },
      { width: 12 },
      { width: 15 },
      { width: 15 }
    ];

    workbook.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, "Modelo_Importacao_Produtos.xlsx");
    });
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target.result;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];

        const importedProducts = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Pula cabeçalho

          const nomeVal = row.getCell(1).value;
          const nome = nomeVal?.toString() || nomeVal?.text || "";
          
          const precoVal = row.getCell(2).value;
          const preco = typeof precoVal === 'object' ? parseFloat(precoVal?.result || 0) : parseFloat(precoVal || 0);
          
          const grupoVal = row.getCell(3).value;
          const grupo = grupoVal?.toString() || grupoVal?.text || "Outros";
          
          const imagemVal = row.getCell(4).value;
          const imagem = imagemVal?.toString() || imagemVal?.text || "📦";

          if (nome && !isNaN(preco)) {
            importedProducts.push({ nome, preco, grupo, imagem });
          }
        });

        if (importedProducts.length === 0) {
          alert("Nenhum produto válido encontrado na planilha. Verifique o formato do modelo.");
          return;
        }

        setProdutosParaImportar(importedProducts);
        setModalImportar(true);
      } catch (err) {
        console.error("Erro ao processar planilha:", err);
        alert("Ocorreu um erro ao ler a planilha. Verifique se o arquivo está no formato XLSX.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // Reseta o input de arquivo
  };

  const confirmarImportacao = async () => {
    if (produtosParaImportar.length === 0 || !eventoId) return;
    setImportando(true);
    setError("");

    try {
      const res = await fetch("/api/produtos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtos: produtosParaImportar,
          eventoId
        })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setModalImportar(false);
        setProdutosParaImportar([]);
        carregarProdutos();
      }
    } catch (err) {
      setError("Erro ao importar produtos em lote.");
    } finally {
      setImportando(false);
    }
  };

  const abrirNovoProduto = () => {
    setProdutoEditando(null);
    setNome("");
    setPreco("");
    setGrupo("Bebidas");
    setImagem("📦");
    setNovoGrupo("");
    setMostrarNovoGrupoInput(false);
    setModalProduto(true);
  };

  const abrirEditarProduto = (p) => {
    setProdutoEditando(p);
    setNome(p.nome);
    setPreco(p.preco.toString());
    setGrupo(p.grupo);
    setImagem(p.imagem || "📦");
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
          imagem,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
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
          <div className="flex gap-2 flex-wrap justify-start md:justify-end w-full md:w-auto">
            <button
              onClick={baixarTemplateExcel}
              className="bg-gray-100 text-gray-700 font-bold text-base px-4 py-3 rounded-2xl hover:bg-gray-200 transition-all flex items-center gap-1.5"
              style={{ minHeight: "52px" }}
              title="Baixar planilha modelo de importação"
            >
              📥 Modelo XLSX
            </button>
            <label
              className="bg-green-600 text-white font-bold text-base px-5 py-3 rounded-2xl hover:bg-green-700 transition-all flex items-center gap-1.5 cursor-pointer"
              style={{ minHeight: "52px" }}
            >
              <span>🟢</span> Importar XLSX
              <input
                type="file"
                accept=".xlsx"
                onChange={handleImportExcel}
                className="hidden"
              />
            </label>
            <button
              onClick={abrirNovoProduto}
              className="bg-[#1D3461] text-white font-black text-base px-6 py-3 rounded-2xl hover:bg-blue-900 transition-all"
              style={{ minHeight: "52px" }}
            >
              + Novo Produto
            </button>
          </div>
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
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-2xl w-full overflow-x-auto whitespace-nowrap scrollbar-none">
        {[
          { id: "produtos", label: "🍺 Cardápio de Produtos" },
          { id: "pagamentos", label: "💳 Métodos de Pagamento" },
          { id: "gateway", label: "🔌 Configuração do Gateway" },
        ].map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`px-5 py-3 rounded-xl font-black text-base transition-all shrink-0 ${
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
                  <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-3xl shrink-0">{p.imagem || "📦"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-gray-900 text-xl truncate">{p.nome}</p>
                        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-0.5 rounded-full inline-block mt-0.5">
                          {p.grupo}
                        </span>
                      </div>
                      <p className="font-black text-[#1D3461] text-2xl shrink-0 text-right sm:w-32">
                        R$ {p.preco.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => toggleAtivoProduto(p)}
                        className={`px-4 py-2 rounded-2xl font-black text-base transition-all ${p.ativo ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-50 text-red-500 hover:bg-red-100"}`}
                        style={{ minHeight: "44px" }}
                      >
                        <span>{p.ativo ? "✅" : "❌"}</span>
                        <span className="hidden sm:inline ml-1">{p.ativo ? "Ativo" : "Inativo"}</span>
                      </button>
                      <button
                        onClick={() => abrirEditarProduto(p)}
                        className="px-4 py-2 rounded-2xl font-black text-base bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all flex items-center gap-1"
                        style={{ minHeight: "44px" }}
                      >
                        <span>✏️</span>
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                      <button
                        onClick={() => excluirProduto(p.id)}
                        className="px-4 py-2 rounded-2xl font-black text-base bg-red-50 text-red-500 hover:bg-red-100 transition-all flex items-center gap-1"
                        style={{ minHeight: "44px" }}
                      >
                        <span>🗑️</span>
                        <span className="hidden sm:inline">Excluir</span>
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

      {/* ABA: GATEWAY */}
      {aba === "gateway" && (
        <div className="space-y-6">
          <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-5 mb-6 font-semibold">
            <p className="font-black text-blue-800 text-lg">🔌 Integração com Gateways de Pagamento</p>
            <p className="text-blue-700 text-base mt-1">
              Configure as credenciais da sua conta Asaas ou PagBank para receber pagamentos dinâmicos de Pix e Cartão de Crédito direto na sua conta.
            </p>
          </div>

          <div className="bg-white rounded-3xl border-2 border-gray-100 p-6 md:p-8 shadow-sm">
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSalvandoGateway(true);
              setSucessoGateway("");
              setError("");
              try {
                const res = await fetch(`/api/usuarios/${session.user.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    gatewayActive,
                    asaasToken: asaasToken.trim(),
                    asaasUrl: asaasUrl.trim(),
                    pagbankToken: pagbankToken.trim(),
                    pagbankKey: pagbankKey.trim()
                  })
                });
                const data = await res.json();
                if (!res.ok) {
                  setError(data.error || "Erro ao salvar credenciais.");
                } else {
                  setSucessoGateway("Configurações do gateway salvas com sucesso!");
                  setTimeout(() => setSucessoGateway(""), 4000);
                }
              } catch (err) {
                setError("Erro de conexão ao salvar configurações.");
              } finally {
                setSalvandoGateway(false);
              }
            }} className="space-y-6">
              {/* Seletor do Gateway */}
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">Gateway de Pagamento Ativo *</label>
                <p className="text-gray-400 text-sm font-semibold mb-3">Escolha qual gateway processará as recargas no caixa (POS).</p>
                <select
                  value={gatewayActive}
                  onChange={(e) => setGatewayActive(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461] bg-white"
                  style={{ minHeight: "52px" }}
                >
                  <option value="ASAAS">Asaas (Recomendado para Pix e Cartão Online)</option>
                  <option value="PAGBANK">PagBank (Smart POS / Integrações Locais)</option>
                  <option value="NENHUM">Nenhum / Desativado (Apenas Simulação)</option>
                </select>
              </div>

              {/* Seção Asaas */}
              {gatewayActive === "ASAAS" && (
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">🔵</span>
                    <h4 className="text-xl font-black text-gray-900">Configurações do Asaas</h4>
                  </div>
                  
                  <div>
                    <label className="block font-bold text-gray-700 text-sm mb-1 uppercase tracking-wide">Access Token (Chave de API) *</label>
                    <input
                      type="password"
                      required
                      value={asaasToken}
                      onChange={(e) => setAsaasToken(e.target.value)}
                      placeholder="Ex: $aae.Y29t..."
                      className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-base font-mono text-gray-900 focus:outline-none focus:border-[#1D3461] bg-white"
                    />
                    <p className="text-gray-400 text-xs mt-1.5 font-semibold">Insira o Token de Acesso gerado em sua conta do Asaas (Configurações → Integrações → Gerar API Key).</p>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 text-sm mb-1 uppercase tracking-wide">URL da API (Opcional)</label>
                    <input
                      type="text"
                      value={asaasUrl}
                      onChange={(e) => setAsaasUrl(e.target.value)}
                      placeholder="Deixe em branco para detecção automática"
                      className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-base font-mono text-gray-900 focus:outline-none focus:border-[#1D3461] bg-white"
                    />
                    <p className="text-gray-400 text-xs mt-1.5 font-semibold">Use `https://sandbox.asaas.com/api` para testes ou deixe em branco para detecção automática (produção).</p>
                  </div>
                </div>
              )}

              {/* Seção PagBank */}
              {gatewayActive === "PAGBANK" && (
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">🟡</span>
                    <h4 className="text-xl font-black text-gray-900">Configurações do PagBank</h4>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 text-sm mb-1 uppercase tracking-wide">Token do PagBank *</label>
                    <input
                      type="password"
                      required
                      value={pagbankToken}
                      onChange={(e) => setPagbankToken(e.target.value)}
                      placeholder="Insira o token do PagBank"
                      className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-base font-mono text-gray-900 focus:outline-none focus:border-[#1D3461] bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 text-sm mb-1 uppercase tracking-wide">Chave de Criptografia (Key) *</label>
                    <input
                      type="password"
                      required
                      value={pagbankKey}
                      onChange={(e) => setPagbankKey(e.target.value)}
                      placeholder="Insira a chave de criptografia do PagBank"
                      className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-base font-mono text-gray-900 focus:outline-none focus:border-[#1D3461] bg-white"
                    />
                  </div>
                </div>
              )}

              {gatewayActive === "NENHUM" && (
                <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-2xl text-yellow-800 font-semibold">
                  ⚠️ No modo simulação, o caixa não criará transações reais. Apenas mostrará QR codes e telas de sucesso fictícias para demonstração.
                </div>
              )}

              {sucessoGateway && (
                <div className="bg-green-500/10 border-2 border-green-500/20 text-green-700 p-4 rounded-2xl font-bold">
                  ✨ {sucessoGateway}
                </div>
              )}

              <button
                type="submit"
                disabled={salvandoGateway}
                className="w-full bg-[#1D3461] hover:bg-blue-900 text-white font-black text-lg py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                style={{ minHeight: "52px" }}
              >
                {salvandoGateway ? "Salvando..." : "💾 Salvar Configurações do Gateway"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRODUTO */}
      {modalProduto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in duration-200 scrollbar-thin">
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

              <div>
                <label className="block font-black text-gray-700 text-base mb-2">Ícone (Emoji) *</label>
                <div className="flex flex-wrap gap-2 mb-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  {["🍺", "🍹", "🥤", "🍔", "🍕", "🍟", "🍿", "🍦", "🍰", "📦", "🎫", "👕"].map((emojiItem) => (
                    <button
                      key={emojiItem}
                      type="button"
                      onClick={() => setImagem(emojiItem)}
                      className={`w-10 h-10 text-2xl flex items-center justify-center rounded-xl transition-all ${
                        imagem === emojiItem ? "bg-[#1D3461] text-white scale-110 shadow-md" : "bg-white hover:bg-gray-200 text-gray-700 border border-gray-100"
                      }`}
                    >
                      {emojiItem}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={imagem}
                  onChange={(e) => setImagem(e.target.value)}
                  placeholder="Ou digite outro emoji/ícone..."
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
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
          <div className="bg-white rounded-3xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in duration-200 scrollbar-thin">
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

      {/* MODAL: IMPORTAÇÃO PLANILHA */}
      {modalImportar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl animate-in fade-in duration-200">
            <h3 className="text-3xl font-black text-[#1D3461] mb-2 flex items-center gap-2">
              <span>📋</span> Confirmar Importação de Produtos
            </h3>
            <p className="text-gray-500 font-semibold mb-6">
              Encontramos {produtosParaImportar.length} produtos válidos na sua planilha. Deseja importá-los para este evento?
            </p>

            <div className="border-2 border-gray-100 rounded-2xl overflow-hidden mb-6 max-h-60 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold text-xs uppercase tracking-wider">
                    <th className="p-3">Ícone</th>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3 text-right">Preço</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold text-sm">
                  {produtosParaImportar.map((p, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 text-xl">{p.imagem}</td>
                      <td className="p-3 text-gray-900 font-black">{p.nome}</td>
                      <td className="p-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">{p.grupo}</span></td>
                      <td className="p-3 text-right text-gray-900">R$ {p.preco.toFixed(2).replace(".", ",")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setModalImportar(false);
                  setProdutosParaImportar([]);
                }}
                disabled={importando}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-black px-6 py-3 rounded-2xl transition-all"
                style={{ minHeight: "52px" }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarImportacao}
                disabled={importando}
                className="bg-[#1D3461] hover:bg-blue-900 text-white font-black px-6 py-3 rounded-2xl transition-all disabled:opacity-50"
                style={{ minHeight: "52px" }}
              >
                {importando ? "Importando..." : "✅ Confirmar e Importar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
