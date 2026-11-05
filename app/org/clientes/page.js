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
  const { data: session } = useSession();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [error, setError] = useState("");
  const [estornando, setEstornando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);

  const [eventoId, setEventoId] = useState(null);
  const [eventos, setEventos] = useState([]);

  async function exportarClientesXLSX() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "La More Eventos";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Clientes", { properties: { tabColor: { argb: 'FF1D3461' } } });
    ws.mergeCells('A1:F2');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'LA MORE EVENTOS - Relatório de Cadastro de Clientes';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const headerRow = ws.getRow(4);
    headerRow.values = ["Nome", "Código Cartão", "CPF", "Celular", "Saldo Atual (R$)", "Cadastrado Por (Operador)"];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
    headerRow.alignment = { horizontal: 'center' };

    clientes.forEach((c, index) => {
      const isMaster = isMasterView && session?.user?.role === 'MASTER';
      const row = ws.addRow([
        c.cliente.nome,
        c.codigo,
        isMaster ? (c.cliente.cpf || "") : maskCpf(c.cliente.cpf),
        isMaster ? (c.cliente.celular || "") : maskPhone(c.cliente.celular),
        c.saldo,
        c.cadastradoPor || "Sistema"
      ]);
      if (index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      row.getCell(5).numFmt = '"R$ "#,##0.00';
    });

    ws.columns = [
      { width: 30 }, { width: 15 }, { width: 18 }, { width: 18 }, { width: 15 }, { width: 30 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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

    const isMaster = isMasterView && session?.user?.role === 'MASTER';
    autoTable(doc, {
      startY: 40,
      head: [["Nome", "Código", "CPF", "Celular", "Saldo (R$)", "Cadastrado Por"]],
      body: clientes.map(c => [
        c.cliente.nome,
        c.codigo,
        isMaster ? (c.cliente.cpf || "—") : maskCpf(c.cliente.cpf),
        isMaster ? (c.cliente.celular || "—") : maskPhone(c.cliente.celular),
        c.saldo.toFixed(2).replace(".", ","),
        c.cadastradoPor || "Sistema"
      ]),
      theme: 'grid',
      headStyles: { fillColor: [29, 52, 97], textColor: [255, 255, 255] },
      styles: { fontSize: 9 }
    });

    doc.save(`LaMoreEventos_Cadastro_Clientes.pdf`);
  }

  useEffect(() => {
    if (session) {
      if (session.user.role === 'MASTER') {
        fetch("/api/eventos")
          .then((res) => res.json())
          .then((data) => {
            if (data && data.length > 0 && !data.error) {
              setEventos(data);
              const stored = localStorage.getItem("activeEventoId");
              const existe = data.find(e => e.id === stored);
              const idToSet = existe ? stored : data[0].id;
              localStorage.setItem("activeEventoId", idToSet);
              setEventoId(idToSet);
            }
          })
          .catch(console.error);
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

  const handleEstornar = async (codigo, saldo) => {
    if (saldo <= 0) return alert("Este cartão não tem saldo para devolver.");
    if (!confirm(`Tem certeza que deseja DEVOLVER e ZERAR o saldo de R$ ${saldo.toFixed(2).replace('.',',')} deste cartão?`)) return;
    
    setEstornando(codigo);
    try {
      const res = await fetch(`/api/org/clientes/estorno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo })
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

  const handleExcluirCartao = async (cartaoId, codigo, nomeCliente, saldo) => {
    let confirmMsg = `Tem certeza que deseja EXCLUIR DEFINITIVAMENTE o cartão ${codigo} de "${nomeCliente || 'este cliente'}"?\n\nEsta ação apagará permanentemente o cartão e seu histórico do sistema.`;
    if (saldo > 0) {
      confirmMsg += `\n\nATENÇÃO: Este cartão possui R$ ${saldo.toFixed(2).replace('.', ',')} de saldo!`;
    }
    if (!confirm(confirmMsg)) return;

    setExcluindo(cartaoId);
    try {
      const res = await fetch("/api/org/clientes/excluir", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartaoId, codigo, eventoId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message || "Cartão excluído definitivamente com sucesso!");
      carregarClientes();
    } catch (e) {
      alert("Erro ao excluir cartão: " + e.message);
    } finally {
      setExcluindo(null);
    }
  };

  const alterarStatusCartao = async (cartaoId, novoStatus, nomeCliente = '') => {
    const acao = novoStatus === 'ATIVO' ? 'REATIVAR' : 'ENCERRAR';
    const msg = novoStatus === 'ATIVO'
      ? `Deseja realmente REATIVAR o cartão de "${nomeCliente || 'este cliente'}"?\nO acesso ao Web App e consumo será liberado novamente.`
      : `Deseja realmente ENCERRAR o cartão de "${nomeCliente || 'este cliente'}"?\nO acesso à carteira digital será bloqueado.`;

    if (!confirm(msg)) return;
    try {
      const res = await fetch("/api/org/clientes/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, cartaoId, status: novoStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      carregarClientes();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  const alterarStatusTodosCartoes = async (novoStatus) => {
    const acao = novoStatus === 'ATIVO' ? 'REATIVAR' : 'ENCERRAR';
    const promptMsg = novoStatus === 'ATIVO'
      ? "ATENÇÃO: Isso irá REATIVAR TODOS OS CARTÕES deste evento, liberando novamente o acesso e consumo de todos os clientes.\n\nDigite 'REATIVAR' para confirmar:"
      : "ATENÇÃO: Isso irá ENCERRAR TODOS OS CARTÕES deste evento, bloqueando o acesso de todos os clientes à carteira digital.\n\nDigite 'ENCERRAR' para confirmar:";

    const p = prompt(promptMsg);
    if (p !== acao) return;

    try {
      const res = await fetch("/api/org/clientes/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, status: novoStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message || `${novoStatus === 'ATIVO' ? 'Reativação' : 'Encerramento'} concluído com sucesso!`);
      carregarClientes();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  };

  const totalSaldo = clientes.reduce((acc, c) => acc + (c.saldo || 0), 0);
  const totalAtivos = clientes.filter(c => c.status !== 'ENCERRADO').length;
  const totalEncerrados = clientes.filter(c => c.status === 'ENCERRADO').length;

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h2 className="text-2xl sm:text-4xl font-black text-[#1D3461]">Clientes</h2>
          <p className="text-gray-500 text-sm sm:text-lg font-semibold mt-1">
            {clientes.length} cartões ({totalAtivos} ativos, {totalEncerrados} encerrados)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(isMasterView || session?.user?.role === 'MASTER' || session?.user?.role === 'ORGANIZADOR' || session?.user?.role === 'ORG') && (
            <>
              <button 
                onClick={() => alterarStatusTodosCartoes("ATIVO")} 
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs sm:text-sm px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Reativar todos os cartões do evento"
              >
                <span>🔓</span> Reativar Todos
              </button>
              <button 
                onClick={() => alterarStatusTodosCartoes("ENCERRADO")} 
                className="bg-gray-800 hover:bg-black text-white font-black text-xs sm:text-sm px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Encerrar todos os cartões do evento"
              >
                <span>🔒</span> Encerrar Todos
              </button>
            </>
          )}
          <button onClick={exportarClientesXLSX} className="bg-green-600 text-white font-black text-xs sm:text-sm px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl hover:bg-green-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer">
            <span>📊</span> Excel
          </button>
          <button onClick={exportarClientesPDF} className="bg-red-600 text-white font-black text-xs sm:text-sm px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl hover:bg-red-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer">
            <span>📄</span> PDF
          </button>
        </div>
      </div>

      {/* SELETOR DE EVENTO PARA O PAINEL MASTER */}
      {(isMasterView || session?.user?.role === 'MASTER') && eventos.length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-auto flex-1">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Filtrar Clientes por Evento</label>
            <select
              value={eventoId || ""}
              onChange={(e) => {
                setEventoId(e.target.value);
                localStorage.setItem("activeEventoId", e.target.value);
              }}
              className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#1D3461] rounded-xl px-4 py-2.5 font-bold text-[#1D3461] outline-none transition-all text-sm sm:text-base"
            >
              {eventos.map(ev => (
                <option key={ev.id} value={ev.id}>🎪 {ev.nome}</option>
              ))}
            </select>
          </div>
          <div className="text-right text-xs font-bold text-gray-400 hidden md:block">
            Alternando base de clientes em tempo real
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-300 text-red-700 p-4 rounded-2xl mb-6 font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-4 sm:p-5">
          <span className="text-3xl sm:text-4xl">👤</span>
          <p className="text-2xl sm:text-3xl font-black text-blue-700 mt-1.5 sm:mt-2">{clientes.length}</p>
          <p className="text-blue-600 font-bold text-xs sm:text-lg leading-tight">Total de Cartões</p>
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-100 rounded-3xl p-4 sm:p-5">
          <span className="text-3xl sm:text-4xl">⏳</span>
          <p className="text-xl sm:text-3xl font-black text-yellow-700 mt-1.5 sm:mt-2 break-all">R$ {totalSaldo.toFixed(2).replace(".", ",")}</p>
          <p className="text-yellow-600 font-bold text-xs sm:text-lg leading-tight">Saldo em Aberto</p>
        </div>
        <div className="bg-green-50 border-2 border-green-100 rounded-3xl p-4 sm:p-5">
          <span className="text-3xl sm:text-4xl">📱</span>
          <p className="text-2xl sm:text-3xl font-black text-green-700 mt-1.5 sm:mt-2">{clientes.filter(c => c.cadastradoPor === "Sistema / Outro").length}</p>
          <p className="text-green-600 font-bold text-xs sm:text-lg leading-tight">Auto-cadastro (QR)</p>
        </div>
        <div className="bg-purple-50 border-2 border-purple-100 rounded-3xl p-4 sm:p-5">
          <span className="text-3xl sm:text-4xl">🏪</span>
          <p className="text-2xl sm:text-3xl font-black text-purple-700 mt-1.5 sm:mt-2">{clientes.filter(c => c.cadastradoPor !== "Sistema / Outro").length}</p>
          <p className="text-purple-600 font-bold text-xs sm:text-lg leading-tight">Cadastros no Caixa</p>
        </div>
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔍  Buscar por nome, CPF ou código..."
          className="w-full border-2 border-gray-200 rounded-2xl px-4 sm:px-5 py-3.5 sm:py-4 text-base sm:text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
        <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="col-span-4 text-xs font-black text-gray-400 uppercase tracking-widest">Cliente</p>
          <p className="col-span-3 text-xs font-black text-gray-400 uppercase tracking-widest">CPF</p>
          <p className="col-span-2 text-xs font-black text-gray-400 uppercase tracking-widest">Celular</p>
          <p className="col-span-3 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Saldo / Ações</p>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <p className="text-center text-gray-400 font-semibold text-lg py-12">Carregando lista...</p>
          ) : clientes.length === 0 ? (
            <p className="text-center text-gray-400 font-semibold text-lg py-12">Nenhum cliente cadastrado ainda.</p>
          ) : (
            clientes.map((c) => (
              <div key={c.id} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 px-4 sm:px-6 py-4 md:items-center hover:bg-gray-50 transition-colors">
                <div className="md:col-span-4 min-w-0">
                  <div className="flex items-start justify-between gap-2 md:block">
                    <p className="font-black text-gray-900 text-base sm:text-lg break-words">{c.cliente.nome}</p>
                    <p className={`md:hidden font-black text-lg shrink-0 ${c.saldo > 0 ? "text-green-600" : "text-gray-400"}`}>
                      R$ {c.saldo.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center text-xs font-bold text-gray-400 mt-1">
                    <span className="uppercase font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">Cód: {c.codigo}</span>
                    <span>•</span>
                    <span className="text-blue-500/80">Reg: {c.cadastradoPor}</span>
                    {c.cliente.cpf && (
                      <span className="md:hidden">
                        • CPF: {(isMasterView && session?.user?.role === 'MASTER') ? c.cliente.cpf : maskCpf(c.cliente.cpf)}
                      </span>
                    )}
                    {c.cliente.celular && (
                      <span className="md:hidden">
                        • Tel: {(isMasterView && session?.user?.role === 'MASTER') ? c.cliente.celular : maskPhone(c.cliente.celular)}
                      </span>
                    )}
                  </div>
                </div>
                <p className="hidden md:block md:col-span-3 text-gray-500 font-semibold text-base">
                  {(isMasterView && session?.user?.role === 'MASTER')
                    ? (c.cliente.cpf || <span className="text-gray-300 italic">—</span>)
                    : <span>{maskCpf(c.cliente.cpf)}</span>}
                </p>
                <p className="hidden md:block md:col-span-2 text-gray-500 font-semibold text-base">
                  {(isMasterView && session?.user?.role === 'MASTER')
                    ? (c.cliente.celular || <span className="text-gray-300 italic">—</span>)
                    : <span>{maskPhone(c.cliente.celular)}</span>}
                </p>
                <div className="md:col-span-3 flex flex-col md:items-end gap-2">
                  <p className={`hidden md:block font-black text-xl text-right ${c.saldo > 0 ? "text-green-600" : "text-gray-400"}`}>
                    R$ {c.saldo.toFixed(2).replace(".", ",")}
                  </p>
                  
                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-1.5">
                    {/* Badge de status */}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      c.status === "ENCERRADO" 
                        ? "bg-gray-100 text-gray-600 border border-gray-300" 
                        : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    }`}>
                      {c.status === "ENCERRADO" ? "🔒 Encerrado" : "● Ativo"}
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Botão de Devolver (Master) */}
                      {(isMasterView || session?.user?.role === 'MASTER') && c.saldo > 0 && (
                        <button 
                          onClick={() => handleEstornar(c.codigo, c.saldo)}
                          disabled={estornando === c.codigo}
                          className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                          title="Devolver e zerar saldo"
                        >
                          {estornando === c.codigo ? "..." : "Devolver"}
                        </button>
                      )}

                      {/* Botão de Ação: Reativar ou Encerrar Individual */}
                      {c.status === "ENCERRADO" ? (
                        <button 
                          onClick={() => alterarStatusCartao(c.id, "ATIVO", c.cliente.nome)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                          title="Reativar acesso e consumo deste cartão"
                        >
                          <span>🔓</span> Reativar
                        </button>
                      ) : (
                        <button 
                          onClick={() => alterarStatusCartao(c.id, "ENCERRADO", c.cliente.nome)}
                          className="bg-gray-700 hover:bg-black text-white font-black text-[11px] px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                          title="Encerrar/Bloquear acesso a este cartão"
                        >
                          <span>🔒</span> Encerrar
                        </button>
                      )}

                      {/* Botão de Excluir Definitivamente */}
                      <button 
                        onClick={() => handleExcluirCartao(c.id, c.codigo, c.cliente.nome, c.saldo)}
                        disabled={excluindo === c.id}
                        className="bg-red-600 hover:bg-red-700 text-white font-black text-[11px] px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Excluir definitivamente este cartão com dados incorretos"
                      >
                        <span>🗑️</span> {excluindo === c.id ? "..." : "Excluir"}
                      </button>
                    </div>
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
