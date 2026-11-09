"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function maskCpf(cpf) {
  if (!cpf) return "—";
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11) return cpf;
  return `${c.slice(0, 3)}.***.***-${c.slice(9)}`;
}

function maskPhone(phone) {
  if (!phone) return "—";
  const p = phone.replace(/\D/g, "");
  if (p.length === 11) return `(${p.slice(0, 2)}) *****-${p.slice(7)}`;
  if (p.length === 10) return `(${p.slice(0, 2)}) ****-${p.slice(6)}`;
  return phone;
}

export default function ClientesPage({ isMasterView = false }) {
  const { data: session, status } = useSession();
  const isSupport =
    session?.user?.role === "SUPORTE_OPERACIONAL" ||
    session?.user?.role === "CLIENTE" ||
    session?.user?.role === "SUPORTE";

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("ativos"); // ativos | desativados | todos
  const [error, setError] = useState("");
  const [estornando, setEstornando] = useState(null);

  const [eventoId, setEventoId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("activeEventoId") || null : null));
  const [eventos, setEventos] = useState([]);

  async function exportarClientesXLSX() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "La More Eventos";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Clientes", {
      properties: { tabColor: { argb: "FF1D3461" } },
    });
    ws.mergeCells("A1:G2");
    const titleCell = ws.getCell("A1");
    titleCell.value = "LA MORE EVENTOS - Relatório de Cadastro de Clientes";
    titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D3461" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    const headerRow = ws.getRow(4);
    headerRow.values = [
      "Status",
      "Nome",
      "Código Cartão",
      "CPF",
      "Celular",
      "Saldo Atual (R$)",
      "Cadastrado Por (Operador)",
    ];
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };
    headerRow.alignment = { horizontal: "center" };

    clientes.forEach((c, index) => {
      const isMaster = isMasterView && session?.user?.role === "MASTER";
      const row = ws.addRow([
        c.status === "ENCERRADO" ? "DESATIVADO" : "ATIVO",
        c.cliente.nome,
        c.codigo,
        isMaster ? c.cliente.cpf || "" : maskCpf(c.cliente.cpf),
        isMaster ? c.cliente.celular || "" : maskPhone(c.cliente.celular),
        c.saldo,
        c.cadastradoPor || "Sistema",
      ]);
      if (index % 2 === 0)
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      row.getCell(6).numFmt = '"R$ "#,##0.00';
    });

    ws.columns = [
      { width: 15 },
      { width: 30 },
      { width: 15 },
      { width: 18 },
      { width: 18 },
      { width: 15 },
      { width: 30 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, "LaMore_Cadastro_Clientes.xlsx");
  }

  function exportarClientesPDF() {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(29, 52, 97);
    doc.text("LA MORE EVENTOS", 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Relatório de Cadastro de Clientes`, 14, 28);
    doc.text(`Total: ${clientes.length} clientes cadastrados`, 14, 34);

    const isMaster = isMasterView && session?.user?.role === "MASTER";
    autoTable(doc, {
      startY: 40,
      head: [["Status", "Nome", "Código", "CPF", "Celular", "Saldo (R$)", "Cadastrado Por"]],
      body: clientes.map((c) => [
        c.status === "ENCERRADO" ? "DESATIVADO" : "ATIVO",
        c.cliente.nome,
        c.codigo,
        isMaster ? c.cliente.cpf || "—" : maskCpf(c.cliente.cpf),
        isMaster ? c.cliente.celular || "—" : maskPhone(c.cliente.celular),
        c.saldo.toFixed(2).replace(".", ","),
        c.cadastradoPor || "Sistema",
      ]),
      theme: "grid",
      headStyles: { fillColor: [29, 52, 97], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
    });

    doc.save(`LaMoreEventos_Cadastro_Clientes.pdf`);
  }

  useEffect(() => {
    if (session) {
      if (session.user.role === "MASTER" || isMasterView) {
        fetch("/api/eventos")
          .then((res) => res.json())
          .then((data) => {
            if (data && data.length > 0) {
              setEventos(data);
              const stored = localStorage.getItem("activeEventoId");
              const existe = data.find((e) => e.id === stored);
              const idToSet = existe ? stored : data[0].id;
              localStorage.setItem("activeEventoId", idToSet);
              setEventoId(idToSet);
            } else {
              setLoading(false);
            }
          })
          .catch((err) => {
            console.error(err);
            setLoading(false);
          });
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
                } else {
                  setLoading(false);
                }
              })
              .catch((err) => {
                console.error(err);
                setLoading(false);
              });
          }
        }
      }
    }
  }, [session, isMasterView]);

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
      else setClientes(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Erro ao buscar lista de clientes");
    } finally {
      setLoading(false);
    }
  };

  const handleEstornar = async (codigo, saldo, nomeCliente) => {
    if (saldo <= 0) return alert("Este cartão não tem saldo para devolver.");
    if (
      !window.confirm(
        `Você quer realmente DEVOLVER e ZERAR o saldo de R$ ${saldo.toFixed(2).replace(".", ",")} do cliente "${nomeCliente}" (Cartão ${codigo})?`
      )
    )
      return;

    setEstornando(codigo);
    try {
      const res = await fetch(`/api/org/clientes/estorno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      carregarClientes();
      alert("Saldo devolvido e zerado com sucesso!");
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setEstornando(null);
    }
  };

  const alterarStatusCartao = async (cartaoId, novoStatus, nomeCliente = "", codigoCartao = "") => {
    if (novoStatus === "CANCELADO") {
      if (isSupport) {
        alert("O perfil Suporte Operacional não possui permissão para excluir clientes.");
        return;
      }
      const confirmouExclusao = window.confirm(
        `⚠️ CONFIRMAÇÃO DE EXCLUSÃO\n\nVocê quer realmente cancelar/excluir o cliente "${nomeCliente}" (Cartão ${codigoCartao})?\n\n💡 Dica: Se quiser apenas bloquear/desativar o cartão temporariamente para reativar depois, clique em "Cancelar" e use o botão "Desativar".\n\nDeseja realmente EXCLUIR este cliente definitivamente? (Todas as movimentações já realizadas permanecerão salvas nos relatórios detalhados)`
      );
      if (!confirmouExclusao) return;
    }

    try {
      const res = await fetch("/api/org/clientes/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, cartaoId, status: novoStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      carregarClientes();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  const alterarStatusTodosCartoes = async (novoStatus) => {
    const acao = novoStatus === "ATIVO" ? "REATIVAR" : "ENCERRAR";
    const promptMsg =
      novoStatus === "ATIVO"
        ? "ATENÇÃO: Isso irá REATIVAR TODOS OS CARTÕES deste evento, liberando novamente o acesso e consumo de todos os clientes.\n\nDigite 'REATIVAR' para confirmar:"
        : "ATENÇÃO: Isso irá ENCERRAR/DESATIVAR TODOS OS CARTÕES deste evento, bloqueando o acesso de todos os clientes à carteira digital.\n\nDigite 'ENCERRAR' para confirmar:";

    const p = prompt(promptMsg);
    if (p !== acao) return;

    try {
      const res = await fetch("/api/org/clientes/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, status: novoStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(
        data.message ||
          `${novoStatus === "ATIVO" ? "Reativação" : "Encerramento"} concluído com sucesso!`
      );
      carregarClientes();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  const totalSaldo = clientes.reduce((acc, c) => acc + (c.saldo || 0), 0);
  const totalAtivos = clientes.filter((c) => c.status !== "ENCERRADO").length;
  const totalEncerrados = clientes.filter((c) => c.status === "ENCERRADO").length;

  const clientesFiltrados = clientes.filter((c) => {
    if (statusFiltro === "ativos") return c.status !== "ENCERRADO";
    if (statusFiltro === "desativados") return c.status === "ENCERRADO";
    return true;
  });

  if (status === "loading" || (loading && !clientes.length && !error)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 min-h-[350px]">
        <div className="w-10 h-10 border-4 border-[#1D3461] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[#1D3461] font-black text-base animate-pulse">Carregando dados de clientes...</p>
      </div>
    );
  }

  if (!eventoId) {
    return (
      <div className="bg-white rounded-3xl p-10 text-center border-2 border-gray-100 shadow-sm mt-8 max-w-lg mx-auto">
        <span className="text-5xl block mb-3">🎪</span>
        <h3 className="text-[#1D3461] text-xl font-black mb-1">Nenhum evento selecionado</h3>
        <p className="text-gray-500 font-medium text-sm">
          Selecione ou vincule um evento ativo para gerenciar a carteira de clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#1D3461]">Clientes</h2>
          <p className="text-gray-500 text-base sm:text-lg font-semibold mt-1">
            {clientes.length} cartões ({totalAtivos} ativos · {totalEncerrados} desativados/encerrados)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isSupport && (
            <>
              <button
                onClick={() => alterarStatusTodosCartoes("ATIVO")}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm px-4 py-3 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Reativar todos os cartões do evento"
              >
                <span>🔓</span> Reativar Todos
              </button>
              <button
                onClick={() => alterarStatusTodosCartoes("ENCERRADO")}
                className="bg-gray-800 hover:bg-black text-white font-black text-sm px-4 py-3 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Desativar/Encerrar todos os cartões do evento"
              >
                <span>🔒</span> Desativar Todos
              </button>
            </>
          )}
          <button
            onClick={exportarClientesXLSX}
            className="bg-green-600 text-white font-black text-sm px-4 py-3 rounded-xl hover:bg-green-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>📊</span> Excel
          </button>
          <button
            onClick={exportarClientesPDF}
            className="bg-red-600 text-white font-black text-sm px-4 py-3 rounded-xl hover:bg-red-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>📄</span> PDF
          </button>
        </div>
      </div>

      {/* SELETOR DE EVENTO PARA O PAINEL MASTER */}
      {(isMasterView || session?.user?.role === "MASTER") && eventos.length > 0 && (
        <div className="bg-white p-5 rounded-3xl border-2 border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-auto flex-1">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              Filtrar Clientes por Evento
            </label>
            <select
              value={eventoId || ""}
              onChange={(e) => {
                setEventoId(e.target.value);
                localStorage.setItem("activeEventoId", e.target.value);
              }}
              className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#1D3461] rounded-xl px-4 py-2.5 font-bold text-[#1D3461] outline-none transition-all"
            >
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  🎪 {ev.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="text-right text-xs font-bold text-gray-400">
            Alternando base de clientes em tempo real
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-5">
          <span className="text-3xl sm:text-4xl">👤</span>
          <p className="text-2xl sm:text-3xl font-black text-blue-700 mt-2">{clientes.length}</p>
          <p className="text-blue-600 font-bold text-sm sm:text-lg">Total de Cartões</p>
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-100 rounded-3xl p-5">
          <span className="text-3xl sm:text-4xl">⏳</span>
          <p className="text-2xl sm:text-3xl font-black text-yellow-700 mt-2">
            R$ {totalSaldo.toFixed(2).replace(".", ",")}
          </p>
          <p className="text-yellow-600 font-bold text-sm sm:text-lg">Saldo em Aberto</p>
        </div>
        <div className="bg-green-50 border-2 border-green-100 rounded-3xl p-5">
          <span className="text-3xl sm:text-4xl">📱</span>
          <p className="text-2xl sm:text-3xl font-black text-green-700 mt-2">
            {clientes.filter((c) => c.cadastradoPor === "Sistema / Outro").length}
          </p>
          <p className="text-green-600 font-bold text-sm sm:text-lg">Auto-cadastro (QR)</p>
        </div>
        <div className="bg-purple-50 border-2 border-purple-100 rounded-3xl p-5">
          <span className="text-3xl sm:text-4xl">🏪</span>
          <p className="text-2xl sm:text-3xl font-black text-purple-700 mt-2">
            {clientes.filter((c) => c.cadastradoPor !== "Sistema / Outro").length}
          </p>
          <p className="text-purple-600 font-bold text-sm sm:text-lg">Cadastros no Caixa</p>
        </div>
      </div>

      {/* Abas Ativos vs Desativados + Busca */}
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
            <span>✅ Clientes Ativos</span>
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
            <span>⏸️ Clientes Desativados</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black ${
                statusFiltro === "desativados"
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {totalEncerrados}
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
              {clientes.length}
            </span>
          </button>
        </div>

        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔍 Buscar por nome, CPF ou código..."
            className="w-full bg-white border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm sm:text-base font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="col-span-7 md:col-span-4 text-xs font-black text-gray-400 uppercase tracking-widest">
            Cliente
          </p>
          <p className="hidden md:block md:col-span-2 text-xs font-black text-gray-400 uppercase tracking-widest">
            CPF
          </p>
          <p className="hidden md:block md:col-span-2 text-xs font-black text-gray-400 uppercase tracking-widest">
            Celular
          </p>
          <p className="col-span-5 md:col-span-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">
            Saldo / Ações
          </p>
        </div>

        <div className="divide-y divide-gray-50">
          {loading ? (
            <p className="text-center text-gray-400 font-semibold text-lg py-12">
              Carregando lista...
            </p>
          ) : clientesFiltrados.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-gray-400 font-semibold text-lg">
                {statusFiltro === "desativados"
                  ? "Nenhum cliente desativado no momento."
                  : "Nenhum cliente encontrado."}
              </p>
            </div>
          ) : (
            clientesFiltrados.map((c) => (
              <div
                key={c.id}
                className={`grid grid-cols-12 gap-4 px-5 sm:px-6 py-4 items-center transition-colors ${
                  c.status === "ENCERRADO"
                    ? "bg-amber-50/40 hover:bg-amber-50/70"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="col-span-7 md:col-span-4">
                  <p className="font-black text-gray-900 text-base sm:text-lg">{c.cliente.nome}</p>
                  <div className="flex flex-wrap gap-1 md:gap-2 items-center text-xs font-bold text-gray-400 mt-0.5">
                    <span className="uppercase font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                      Cód: {c.codigo}
                    </span>
                    <span>•</span>
                    <span className="text-blue-500/80">Reg: {c.cadastradoPor}</span>
                    {c.cliente.cpf && (
                      <span className="md:hidden">
                        • CPF:{" "}
                        {isMasterView && session?.user?.role === "MASTER"
                          ? c.cliente.cpf
                          : maskCpf(c.cliente.cpf)}
                      </span>
                    )}
                  </div>
                </div>
                <p className="hidden md:block md:col-span-2 text-gray-500 font-semibold text-sm">
                  {isMasterView && session?.user?.role === "MASTER" ? (
                    c.cliente.cpf || <span className="text-gray-300 italic">—</span>
                  ) : (
                    <span>{maskCpf(c.cliente.cpf)}</span>
                  )}
                </p>
                <p className="hidden md:block md:col-span-2 text-gray-500 font-semibold text-sm">
                  {isMasterView && session?.user?.role === "MASTER" ? (
                    c.cliente.celular || <span className="text-gray-300 italic">—</span>
                  ) : (
                    <span>{maskPhone(c.cliente.celular)}</span>
                  )}
                </p>
                <div className="col-span-5 md:col-span-4 flex flex-col items-end gap-1.5">
                  <p
                    className={`font-black text-lg sm:text-xl text-right ${
                      c.saldo > 0 ? "text-green-600" : "text-gray-400"
                    }`}
                  >
                    R$ {c.saldo.toFixed(2).replace(".", ",")}
                  </p>

                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        c.status === "ENCERRADO"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      }`}
                    >
                      {c.status === "ENCERRADO" ? "⏸️ Desativado" : "● Ativo"}
                    </span>

                    {(isMasterView || session?.user?.role === "MASTER") && c.saldo > 0 && (
                      <button
                        onClick={() => handleEstornar(c.codigo, c.saldo, c.cliente.nome)}
                        disabled={estornando === c.codigo}
                        className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                        title="Devolver e zerar saldo"
                      >
                        {estornando === c.codigo ? "..." : "Devolver"}
                      </button>
                    )}

                    {/* Botão Desativar / Reativar */}
                    {c.status === "ENCERRADO" ? (
                      <button
                        onClick={() =>
                          alterarStatusCartao(c.id, "ATIVO", c.cliente.nome, c.codigo)
                        }
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                        title="Reativar acesso e consumo deste cartão"
                      >
                        <span>✅</span> Reativar
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          alterarStatusCartao(c.id, "ENCERRADO", c.cliente.nome, c.codigo)
                        }
                        className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                        title="Desativar/Bloquear temporariamente este cartão"
                      >
                        <span>⏸️</span> Desativar
                      </button>
                    )}

                    {/* Botão Excluir Cliente — Proibido para Suporte Operacional */}
                    {!isSupport && (
                      <button
                        onClick={() =>
                          alterarStatusCartao(c.id, "CANCELADO", c.cliente.nome, c.codigo)
                        }
                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-black text-[10px] px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                        title="Cancelar/Excluir este cliente (mantém histórico nos relatórios)"
                      >
                        <span>🗑️</span> Excluir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
