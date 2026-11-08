"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { exportarPlanilhaProdutosMaster } from "@/lib/exportProdutosXlsx";

export default function ProdutosPage() {
  const { data: session } = useSession();
  const isMaster = session?.user?.role === "MASTER";
  const isSupport =
    session?.user?.role === "SUPORTE_OPERACIONAL" ||
    session?.user?.role === "CLIENTE" ||
    session?.user?.role === "SUPORTE";

  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportandoXlsx, setExportandoXlsx] = useState(false);

  const [aba, setAba] = useState("produtos"); // produtos | pagamentos
  const [statusFiltro, setStatusFiltro] = useState("ativos"); // ativos | desativados | todos
  const [grupoFiltro, setGrupoFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

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
  const [observacao, setObservacao] = useState("");
  const [precoVariavel, setPrecoVariavel] = useState(false);
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

  const grupos = [...new Set(produtos.map((p) => p.grupo).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  const [eventoId, setEventoId] = useState(null);
  const [eventoNome, setEventoNome] = useState("");

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
      carregarProdutos();
      carregarEvento();
    }
  }, [eventoId]);

  const carregarEvento = async () => {
    try {
      const res = await fetch(`/api/eventos/${eventoId}`);
      const data = await res.json();
      if (!data.error) {
        setEventoNome(data.nome || "");
        const defaultPgs = [
          { id: "pix", label: "Pix Online (QR Code)", emoji: "🟢", ativo: true, descricao: "Gera QRCode via Gateway. Confirma automático." },
          { id: "cartao", label: "Cartão Online", emoji: "💳", ativo: true, descricao: "Digitação do cartão no sistema via Asaas/Mercado Pago" },
          { id: "wallet", label: "Carteira Digital (QR)", emoji: "📱", ativo: true, descricao: "Gera QR Code para o cliente pagar no próprio celular" },
          { id: "dinheiro", label: "Dinheiro", emoji: "💵", ativo: true, descricao: "Dinheiro em espécie (com calculadora de troco no caixa)", troco: true },
          { id: "debito_offline", label: "Débito (Máquininha)", emoji: "💳", ativo: true, descricao: "Uso de POS Física. O sistema só registra a venda offline." },
          { id: "credito_offline", label: "Crédito (Máquininha)", emoji: "💳", ativo: true, descricao: "Uso de POS Física. O sistema só registra a venda offline." },
          { id: "pix_offline", label: "Pix (Offline)", emoji: "🟢", ativo: true, descricao: "Transferência direta sem gateway. Caixa confirma manualmente." },
          { id: "cortesia", label: "Cortesia", emoji: "🎁", ativo: true, descricao: "Adiciona saldo sem cobrar nada. Apenas Tesouraria e Master." },
        ];

        if (data.metodosPagamentoJson) {
          const savedPgs = JSON.parse(data.metodosPagamentoJson);
          defaultPgs.forEach((defM) => {
            if (!savedPgs.find((m) => m.id === defM.id)) {
              savedPgs.push(defM);
            }
          });
          setPagamentosConfig(savedPgs);
        } else {
          setPagamentosConfig(defaultPgs);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar configurações de pagamento", e);
    }
  };

  const salvarMetodosPagamento = async (novosMetodos, mensagemConfirmacao) => {
    if (mensagemConfirmacao && !window.confirm(mensagemConfirmacao)) return;
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
      const res = await fetch(`/api/produtos?eventoId=${eventoId}&includeInactive=true`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setProdutos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const handleExportarProdutosMaster = async () => {
    if (!isMaster || !eventoId) return;
    try {
      setExportandoXlsx(true);
      await exportarPlanilhaProdutosMaster({ eventoId, eventoNome });
    } catch (e) {
      alert(e.message || "Erro ao exportar planilha de produtos.");
    } finally {
      setExportandoXlsx(false);
    }
  };

  const baixarTemplateExcel = () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Modelo de Produtos");
    sheet.addRow(["Nome", "Preço", "Categoria", "Ícone (Emoji)"]);
    sheet.addRow(["Heineken 600ml", 18.0, "Bebidas", "🍺"]);
    sheet.addRow(["Hambúrguer Gourmet", 35.5, "Food", "🍔"]);
    sheet.addRow(["Batata Frita", 20.0, "Food", "🍟"]);
    sheet.addRow(["Coca-Cola Lata", 8.0, "Bebidas", "🥤"]);
    sheet.addRow(["Água Mineral", 5.0, "Bebidas", "🥤"]);
    sheet.addRow(["Sorvete de Casquinha", 12.0, "Sobremesas", "🍦"]);

    sheet.columns = [{ width: 25 }, { width: 12 }, { width: 15 }, { width: 15 }];

    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
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
          if (rowNumber === 1) return;

          const nomeVal = row.getCell(1).value;
          const nomeStr = nomeVal?.toString() || nomeVal?.text || "";

          const precoVal = row.getCell(2).value;
          const precoNum =
            typeof precoVal === "object"
              ? parseFloat(precoVal?.result || 0)
              : parseFloat(precoVal || 0);

          const grupoVal = row.getCell(3).value;
          const grupoStr = grupoVal?.toString() || grupoVal?.text || "Outros";

          const imagemVal = row.getCell(4).value;
          const imagemStr = imagemVal?.toString() || imagemVal?.text || "📦";

          if (nomeStr && !isNaN(precoNum)) {
            importedProducts.push({
              nome: nomeStr,
              preco: precoNum,
              grupo: grupoStr,
              imagem: imagemStr,
            });
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
    e.target.value = "";
  };

  const confirmarImportacao = async () => {
    if (produtosParaImportar.length === 0 || !eventoId) return;
    if (
      !window.confirm(
        `Você quer realmente incluir estes ${produtosParaImportar.length} produtos no cardápio deste evento?`
      )
    ) {
      return;
    }
    setImportando(true);
    setError("");

    try {
      const res = await fetch("/api/produtos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtos: produtosParaImportar,
          eventoId,
        }),
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
    setGrupo(grupos.length > 0 ? grupos[0] : "Bebidas");
    setImagem("📦");
    setObservacao("");
    setPrecoVariavel(false);
    setNovoGrupo("");
    setMostrarNovoGrupoInput(false);
    setModalProduto(true);
  };

  const abrirEditarProduto = (p) => {
    if (isSupport) {
      alert("O perfil Suporte Operacional não possui permissão para editar produtos existentes.");
      return;
    }
    setProdutoEditando(p);
    setNome(p.nome);
    setPreco(p.preco.toString());
    setGrupo(p.grupo);
    setImagem(p.imagem || "📦");
    setObservacao(p.observacao || "");
    setPrecoVariavel(p.precoVariavel || false);
    setNovoGrupo("");
    setMostrarNovoGrupoInput(false);
    setModalProduto(true);
  };

  const salvarProduto = async (e) => {
    e.preventDefault();
    if (!nome || !preco || !eventoId) return;

    const grupoFinal = mostrarNovoGrupoInput && novoGrupo.trim() ? novoGrupo.trim() : grupo;
    const precoFinal =
      isSupport && produtoEditando ? parseFloat(produtoEditando.preco) : parseFloat(preco);

    const msgConfirm = produtoEditando
      ? `Você quer realmente confirmar as alterações no produto "${nome}"?`
      : `Você quer realmente incluir o produto "${nome}" (R$ ${precoFinal.toFixed(2).replace(".", ",")}) no cardápio?`;

    if (!window.confirm(msgConfirm)) return;

    setSalvando(true);
    setError("");

    const url = produtoEditando ? `/api/produtos/${produtoEditando.id}` : "/api/produtos";
    const method = produtoEditando ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          preco: precoFinal,
          grupo: grupoFinal,
          imagem,
          observacao: observacao.trim() || null,
          precoVariavel,
          eventoId,
        }),
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

  const excluirProduto = async (p) => {
    const confirmou = window.confirm(
      `⚠️ CONFIRMAÇÃO DE EXCLUSÃO\n\nVocê quer realmente cancelar/excluir o produto "${p.nome}"?\n\n💡 Dica: Se o produto apenas acabou hoje e você pode precisar ativá-lo novamente amanhã, clique em "Cancelar" aqui e use o botão "Desativar".\n\nDeseja realmente EXCLUIR este produto definitivamente?`
    );
    if (!confirmou) return;

    try {
      const res = await fetch(`/api/produtos/${p.id}`, { method: "DELETE" });
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
        body: JSON.stringify({ ativo: !p.ativo }),
      });
      if (res.ok) carregarProdutos();
      else {
        const err = await res.json();
        if (err?.error) alert(err.error);
      }
    } catch (e) {
      console.error("Erro ao mudar status do produto", e);
    }
  };

  const excluirGrupo = async (grupoNome) => {
    if (
      !window.confirm(
        `Você quer realmente excluir o grupo "${grupoNome}"?\nTodos os produtos pertencentes a ele serão movidos para o grupo "Outros".`
      )
    )
      return;
    try {
      const produtosDoGrupo = produtos.filter((p) => p.grupo === grupoNome);
      for (const p of produtosDoGrupo) {
        await fetch(`/api/produtos/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grupo: "Outros" }),
        });
      }
      if (grupoFiltro === grupoNome) setGrupoFiltro("todos");
      carregarProdutos();
    } catch (e) {
      console.error("Erro ao excluir grupo", e);
    }
  };

  const totalAtivos = produtos.filter((p) => p.ativo).length;
  const totalDesativados = produtos.filter((p) => !p.ativo).length;

  const produtosFiltrados = produtos
    .filter((p) => {
      if (statusFiltro === "ativos") return p.ativo === true;
      if (statusFiltro === "desativados") return p.ativo === false;
      return true;
    })
    .filter((p) => (grupoFiltro === "todos" ? true : p.grupo === grupoFiltro))
    .filter((p) => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return (
        String(p.nome || "").toLowerCase().includes(q) ||
        String(p.grupo || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#1D3461]">
            Cardápio {isSupport ? "" : "& Pagamentos"}
          </h2>
          <p className="text-gray-500 text-base sm:text-lg font-semibold mt-1">
            {!eventoId
              ? "Gerencie o cardápio do evento"
              : aba === "produtos"
              ? `${totalAtivos} ativos · ${totalDesativados} desativados · ${grupos.length} grupos`
              : `${pagamentosConfig.filter((p) => p.ativo).length} métodos ativos`}
          </p>
        </div>
        {aba === "produtos" && eventoId && (
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {isMaster && (
              <button
                onClick={handleExportarProdutosMaster}
                disabled={exportandoXlsx}
                className="w-full sm:w-auto justify-center bg-amber-500 text-white font-black text-sm sm:text-base px-4 py-3 rounded-2xl hover:bg-amber-600 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                style={{ minHeight: "48px" }}
                title="Exclusivo Master: Exportar planilha completa de produtos ativos, desativados e histórico de valores"
              >
                <span>📊</span> {exportandoXlsx ? "Exportando..." : "Exportar Produtos (XLSX)"}
              </button>
            )}
            <button
              onClick={baixarTemplateExcel}
              className="w-full sm:w-auto justify-center bg-gray-100 text-gray-700 font-bold text-sm sm:text-base px-4 py-3 rounded-2xl hover:bg-gray-200 transition-all flex items-center gap-1.5"
              style={{ minHeight: "48px" }}
              title="Baixar planilha modelo de importação"
            >
              <span>📥</span> Modelo XLSX
            </button>
            <label
              className="w-full sm:w-auto justify-center bg-green-600 text-white font-bold text-sm sm:text-base px-4 py-3 rounded-2xl hover:bg-green-700 transition-all flex items-center gap-1.5 cursor-pointer"
              style={{ minHeight: "48px" }}
            >
              <span>🟢</span> Importar XLSX
              <input type="file" accept=".xlsx" onChange={handleImportExcel} className="hidden" />
            </label>
            <button
              onClick={abrirNovoProduto}
              className="w-full sm:w-auto justify-center bg-[#1D3461] text-white font-black text-sm sm:text-base px-5 py-3 rounded-2xl hover:bg-blue-900 transition-all"
              style={{ minHeight: "48px" }}
            >
              + Novo Produto
            </button>
          </div>
        )}
        {aba === "pagamentos" && eventoId && !isSupport && (
          <button
            onClick={() => {
              setPgLabel("");
              setPgEmoji("💳");
              setPgDesc("");
              setPgTroco(false);
              setModalPagamento(true);
            }}
            className="bg-[#1D3461] text-white font-black text-lg px-6 py-3 rounded-2xl hover:bg-blue-900 transition-all"
            style={{ minHeight: "52px" }}
          >
            + Novo Método
          </button>
        )}
      </div>

      {/* ABAS (Apenas para Produtor/Organizador/Master) */}
      {!isSupport && (
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-2xl w-full overflow-x-auto whitespace-nowrap scrollbar-none">
          {[
            { id: "produtos", label: "🍺 Cardápio de Produtos" },
            { id: "pagamentos", label: "💳 Métodos de Pagamento" },
          ].map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`px-5 py-3 rounded-xl font-black text-base transition-all shrink-0 ${
                aba === a.id
                  ? "bg-white text-[#1D3461] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              style={{ minHeight: "52px" }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* ABA: PRODUTOS */}
      {aba === "produtos" &&
        (!eventoId ? (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-gray-100 shadow-sm mt-6">
            <span className="text-6xl block mb-4">🎪</span>
            <p className="text-red-500 text-xl font-bold">
              Este usuário não está vinculado a um evento.
            </p>
            <p className="text-gray-500 mt-2 font-medium">
              Vincule este usuário a um evento no Painel Master para gerenciar o cardápio de produtos.
            </p>
          </div>
        ) : (
          <>
            {/* ABAS DE STATUS: ATIVOS vs DESATIVADOS */}
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
                  <span>✅ Produtos Ativos</span>
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
                  <span>⏸️ Produtos Desativados</span>
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
                    {produtos.length}
                  </span>
                </button>
              </div>

              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="🔍 Buscar produto..."
                  className="w-full bg-white border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#1D3461]"
                />
              </div>
            </div>

            {statusFiltro === "desativados" && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
                <span className="text-2xl">⏸️</span>
                <div>
                  <p className="font-black text-amber-900 text-sm sm:text-base">
                    Ambiente de Produtos Desativados
                  </p>
                  <p className="text-amber-800 text-xs sm:text-sm font-semibold mt-0.5">
                    Os produtos abaixo estão salvos e ocultos temporariamente do Bar e do Cartão Digital. Quando precisar retorná-los ao cardápio, basta clicar em <strong>&ldquo;✅ Reativar&rdquo;</strong> sem precisar cadastrar novamente.
                  </p>
                </div>
              </div>
            )}

            {/* Filtro por grupo */}
            <div className="flex gap-2.5 mb-5 overflow-x-auto pb-1">
              <button
                onClick={() => setGrupoFiltro("todos")}
                className={`px-4 py-2.5 rounded-2xl font-black text-sm sm:text-base whitespace-nowrap transition-all ${
                  grupoFiltro === "todos"
                    ? "bg-[#1D3461] text-white"
                    : "bg-white text-gray-600 border-2 border-gray-100"
                }`}
                style={{ minHeight: "46px" }}
              >
                Todas Categorias
              </button>
              {grupos.map((g) => (
                <button
                  key={g}
                  onClick={() => setGrupoFiltro(g)}
                  className={`px-4 py-2.5 rounded-2xl font-black text-sm sm:text-base whitespace-nowrap transition-all ${
                    grupoFiltro === g
                      ? "bg-[#1D3461] text-white"
                      : "bg-white text-gray-600 border-2 border-gray-100"
                  }`}
                  style={{ minHeight: "46px" }}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
              <div className="divide-y divide-gray-100">
                {loading ? (
                  <p className="text-center text-gray-400 font-semibold text-lg py-12">
                    Carregando cardápio...
                  </p>
                ) : produtosFiltrados.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <p className="text-gray-400 font-bold text-lg">
                      {statusFiltro === "desativados"
                        ? "Nenhum produto desativado no momento."
                        : "Nenhum produto encontrado nesta visualização."}
                    </p>
                    {statusFiltro === "ativos" && totalDesativados > 0 && (
                      <button
                        onClick={() => setStatusFiltro("desativados")}
                        className="mt-3 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-4 py-2 rounded-xl font-black text-sm transition-all"
                      >
                        Ver {totalDesativados} produto(s) na aba Desativados →
                      </button>
                    )}
                  </div>
                ) : (
                  produtosFiltrados.map((p) => {
                    const temAlteracaoPreco =
                      Array.isArray(p.historicoPrecos) && p.historicoPrecos.length > 0;
                    const ultimaAlt = temAlteracaoPreco
                      ? p.historicoPrecos[p.historicoPrecos.length - 1]
                      : null;

                    return (
                      <div
                        key={p.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 sm:px-6 py-4 transition-colors border-b border-gray-50 last:border-0 ${
                          p.ativo ? "hover:bg-gray-50" : "bg-amber-50/40 hover:bg-amber-50/70"
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <span className="text-3xl shrink-0">{p.imagem || "📦"}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className={`font-black text-lg sm:text-xl truncate ${
                                  p.ativo ? "text-gray-900" : "text-gray-500"
                                }`}
                              >
                                {p.nome}
                              </p>
                              <span
                                className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                  p.ativo
                                    ? "bg-green-100 text-green-800"
                                    : "bg-amber-200 text-amber-900"
                                }`}
                              >
                                {p.ativo ? "Ativo" : "Desativado"}
                              </span>
                              {p.precoVariavel && (
                                <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                                  💲 Valor Variável
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-0.5 rounded-full">
                                {p.grupo}
                              </span>
                              {p.criadoPorNome && (
                                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                  👤 {p.criadoPorNome}
                                </span>
                              )}
                              {p.atualizadoPorNome && p.atualizadoPorNome !== p.criadoPorNome && (
                                <span
                                  className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                                  title="Última atualização"
                                >
                                  ✏️ {p.atualizadoPorNome}
                                </span>
                              )}
                              {temAlteracaoPreco && !isSupport && (
                                <span
                                  className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full"
                                  title={p.historicoPrecos
                                    .map(
                                      (h) =>
                                        `De R$ ${Number(h.de || 0).toFixed(2)} para R$ ${Number(
                                          h.para || 0
                                        ).toFixed(2)} (${h.por})`
                                    )
                                    .join(" | ")}
                                >
                                  📊 Era R$ {Number(ultimaAlt.de || 0).toFixed(2).replace(".", ",")} ({p.historicoPrecos.length} alt.)
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="font-black text-[#1D3461] text-xl sm:text-2xl shrink-0 text-right">
                            R$ {p.preco.toFixed(2).replace(".", ",")}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            onClick={() => toggleAtivoProduto(p)}
                            className={`px-3.5 py-2 rounded-2xl font-black text-sm sm:text-base transition-all flex items-center gap-1.5 ${
                              p.ativo
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                            }`}
                            style={{ minHeight: "44px" }}
                            title={
                              p.ativo
                                ? "Desativar temporariamente (vai para a aba Produtos Desativados)"
                                : "Reativar produto no cardápio"
                            }
                          >
                            <span>{p.ativo ? "⏸️" : "✅"}</span>
                            <span>{p.ativo ? "Desativar" : "Reativar"}</span>
                          </button>

                          {!isSupport && (
                            <button
                              onClick={() => abrirEditarProduto(p)}
                              className="px-3.5 py-2 rounded-2xl font-black text-sm sm:text-base bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex items-center gap-1"
                              style={{ minHeight: "44px" }}
                            >
                              <span>✏️</span>
                              <span className="hidden sm:inline">Editar</span>
                            </button>
                          )}

                          <button
                            onClick={() => excluirProduto(p)}
                            className="px-3.5 py-2 rounded-2xl font-black text-sm sm:text-base bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center gap-1"
                            style={{ minHeight: "44px" }}
                            title="Excluir produto permanentemente do cardápio"
                          >
                            <span>🗑️</span>
                            <span className="hidden sm:inline">Excluir</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ))}

      {/* ABA: PAGAMENTOS */}
      {aba === "pagamentos" &&
        (!eventoId ? (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-gray-100 shadow-sm mt-6">
            <span className="text-6xl block mb-4">💳</span>
            <p className="text-red-500 text-xl font-bold">
              Este usuário organizador não está vinculado a um evento.
            </p>
            <p className="text-gray-500 mt-2 font-medium">
              Vincule este usuário a um evento no Painel Master para gerenciar métodos de pagamento.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-5 mb-6 font-semibold">
              <p className="font-black text-blue-800 text-lg">ℹ️ Métodos de Pagamento do Evento</p>
              <p className="text-blue-700 text-base mt-1">
                Configure as formas de pagamento aceitas na bilheteria para emissão de cartões. Todas as alterações serão espelhadas automaticamente nos caixas (POS).
              </p>
            </div>

            {pagamentosConfig.map((pg) => (
              <div
                key={pg.id}
                className={`bg-white rounded-3xl border-2 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-all ${
                  pg.ativo ? "border-gray-100" : "border-gray-100 opacity-50 bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-4 flex-1">
                  <span className="text-4xl sm:text-5xl">{pg.emoji}</span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-gray-900 text-xl sm:text-2xl">{pg.label}</p>
                      {pg.troco && (
                        <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          💵 Admite Troco
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 font-semibold text-sm sm:text-base mt-1">
                      {pg.descricao}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => {
                      const novos = pagamentosConfig.map((p) =>
                        p.id === pg.id ? { ...p, ativo: !p.ativo } : p
                      );
                      salvarMetodosPagamento(
                        novos,
                        `Você quer realmente ${pg.ativo ? "desativar" : "ativar"} o método de pagamento "${pg.label}"?`
                      );
                    }}
                    disabled={salvandoPg}
                    className={`px-4 py-2 rounded-2xl font-black text-base transition-all ${
                      pg.ativo
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-red-50 text-red-500 hover:bg-red-100"
                    }`}
                    style={{ minHeight: "44px" }}
                  >
                    {pg.ativo ? "✅ Ativo" : "❌ Inativo"}
                  </button>
                  {pg.id !== "pix" && pg.id !== "cartao" && pg.id !== "dinheiro" && (
                    <button
                      onClick={() => {
                        const novos = pagamentosConfig.filter((p) => p.id !== pg.id);
                        salvarMetodosPagamento(
                          novos,
                          `Você quer realmente cancelar/excluir o método de pagamento "${pg.label}"?`
                        );
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
        ))}

      {/* MODAL: PRODUTO */}
      {modalProduto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in duration-200 scrollbar-thin">
            <h3 className="text-2xl sm:text-3xl font-black text-[#1D3461] mb-6">
              {produtoEditando ? "✏️ Editar Produto" : "➕ Novo Produto"}
            </h3>
            <form onSubmit={salvarProduto} className="space-y-4">
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">
                  Nome do Produto *
                </label>
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
                  disabled={isSupport && !!produtoEditando}
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="0,00"
                  className={`w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-lg font-semibold ${
                    isSupport && !!produtoEditando
                      ? "bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300"
                      : "text-gray-900 focus:outline-none focus:border-[#1D3461]"
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-black text-gray-700 text-base">
                    Grupo/Categoria *
                  </label>
                  {!mostrarNovoGrupoInput && grupo !== "Outros" && grupo && !isSupport && (
                    <button
                      type="button"
                      onClick={() => excluirGrupo(grupo)}
                      className="text-red-500 text-xs font-bold hover:underline bg-red-50 px-2 py-1 rounded-md transition-colors hover:bg-red-100"
                    >
                      Excluir &ldquo;{grupo}&rdquo;
                    </button>
                  )}
                </div>
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
                  {grupos.length === 0 && <option value="Bebidas">Bebidas</option>}
                  {grupos.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
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
                <label className="block font-black text-gray-700 text-base mb-2">
                  Ícone (Emoji) *
                </label>
                <div className="flex flex-wrap gap-2 mb-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  {["🍺", "🍹", "🥤", "🍔", "🍕", "🍟", "🍿", "🍦", "🍰", "📦", "🎫", "👕"].map(
                    (emojiItem) => (
                      <button
                        key={emojiItem}
                        type="button"
                        onClick={() => setImagem(emojiItem)}
                        className={`w-10 h-10 text-2xl flex items-center justify-center rounded-xl transition-all ${
                          imagem === emojiItem
                            ? "bg-[#1D3461] text-white scale-110 shadow-md"
                            : "bg-white hover:bg-gray-200 text-gray-700 border border-gray-100"
                        }`}
                      >
                        {emojiItem}
                      </button>
                    )
                  )}
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

              <div>
                <label className="block font-black text-gray-700 text-base mb-2">
                  Observação <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: Serve 2 pessoas, disponível até meia-noite..."
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-base font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
                />
              </div>

              <div className="flex items-center justify-between bg-amber-50 border-2 border-amber-200 rounded-2xl px-5 py-4">
                <div>
                  <p className="font-black text-gray-800 text-sm">💲 Preço Variável</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Operador digita o valor na hora da venda
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrecoVariavel(!precoVariavel)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    precoVariavel ? "bg-amber-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      precoVariavel ? "translate-x-7" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex gap-3 mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => setModalProduto(false)}
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

      {/* MODAL: PAGAMENTO */}
      {modalPagamento && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in duration-200 scrollbar-thin">
            <h3 className="text-2xl sm:text-3xl font-black text-[#1D3461] mb-6">
              ➕ Novo Método de Pagamento
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!pgLabel.trim()) return;
                const newId = "custom_" + Date.now();
                const novos = [
                  ...pagamentosConfig,
                  {
                    id: newId,
                    label: pgLabel.trim(),
                    emoji: pgEmoji,
                    descricao: pgDesc.trim(),
                    ativo: true,
                    troco: pgTroco,
                  },
                ];
                salvarMetodosPagamento(
                  novos,
                  `Você quer realmente incluir o método de pagamento "${pgLabel.trim()}"?`
                );
                setModalPagamento(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block font-black text-gray-700 text-base mb-2">
                  Nome do Método *
                </label>
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
                  <label className="block font-black text-gray-700 text-base mb-2">
                    Emoji/Ícone
                  </label>
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
                <button
                  type="button"
                  onClick={() => setModalPagamento(false)}
                  className="flex-1 bg-gray-100 text-gray-700 font-black text-base py-4 rounded-2xl"
                  style={{ minHeight: "52px" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoPg}
                  className="flex-1 bg-[#1D3461] text-white font-black text-base py-4 rounded-2xl disabled:opacity-40"
                  style={{ minHeight: "52px" }}
                >
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl animate-in fade-in duration-200">
            <h3 className="text-2xl sm:text-3xl font-black text-[#1D3461] mb-2 flex items-center gap-2">
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
                      <td className="p-3">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                          {p.grupo}
                        </span>
                      </td>
                      <td className="p-3 text-right text-gray-900">
                        R$ {p.preco.toFixed(2).replace(".", ",")}
                      </td>
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
