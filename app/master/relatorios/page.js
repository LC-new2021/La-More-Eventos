"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const getTodayBR = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
};

const COLORS_GRUPO = ["#1D3461", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6"];
const COLORS_PAGTO = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6"];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-white p-3 border-2 border-gray-100 rounded-xl shadow-lg">
        <p className="font-bold text-gray-900">{label || payload[0].name}</p>
        <p className="font-black text-[#1D3461] text-lg">
          R$ {payload[0].value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {item.percent !== undefined && (
            <span className="text-sm text-gray-500 ml-2">({item.percent}%)</span>
          )}
        </p>
      </div>
    );
  }
  return null;
};

export default function MasterRelatoriosPage() {
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aba, setAba] = useState("bi"); // bi | vendas | produtos | recebimentos | cortesias
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [buscaCortesia, setBuscaCortesia] = useState("");

  const [eventoId, setEventoId] = useState(null);
  const [eventos, setEventos] = useState([]);

  useEffect(() => {
    if (session) {
      if (session.user.role === 'MASTER') {
        fetch("/api/eventos")
          .then((res) => res.json())
          .then((data) => {
            if (data && data.length > 0) {
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
        setEventoId(session.user.eventoId);
      }
    }
  }, [session]);

  useEffect(() => {
    if (eventoId) {
      carregarRelatorios();
    }
  }, [eventoId, dataInicio, dataFim]);

  const carregarRelatorios = async () => {
    try {
      let url = `/api/org/relatorios?eventoId=${eventoId}`;
      if (dataInicio) url += `&dataInicio=${dataInicio}`;
      if (dataFim) url += `&dataFim=${dataFim}`;
      const res = await fetch(url);
      const result = await res.json();
      if (result.error) setError(result.error);
      else setData(result);
    } catch (e) {
      setError("Erro ao carregar relatórios do evento");
    } finally {
      setLoading(false);
    }
  };

  if (!eventoId) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-bold text-xl">Nenhum evento selecionado.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-[#1D3461] text-xl font-bold">Carregando dados de relatórios e BI...</p>
      </div>
    );
  }

  const { summary, vendasPorGrupo, vendasPorProduto, vendasPorHora, recebimentos, vendasMestre, cortesiasConcedidas = [], consumosCortesias = [] } = data || {
    summary: { totalRecarregado: 0, totalDebito: 0, totalEstorno: 0, saldoEmAberto: 0, totalCartoes: 0, totalPedidos: 0, ticketMedio: 0, totalCortesiasValor: 0, totalCortesiasConsumido: 0, totalCortesiasCartoesQtd: 0 },
    vendasPorGrupo: [],
    vendasPorProduto: [],
    vendasPorHora: [],
    recebimentos: [],
    vendasMestre: [],
    cortesiasConcedidas: [],
    consumosCortesias: []
  };

  // Agrupar Cortesias por Pessoa / Cartão
  const cortesiasPorPessoa = cortesiasConcedidas.map(c => {
    const consumos = consumosCortesias.filter(item => item.cartaoCodigo === c.cartaoCodigo);
    const totalGasto = consumos.reduce((acc, item) => acc + item.valor, 0);
    return {
      ...c,
      consumos,
      totalGasto,
      saldoCalculado: Math.max(0, c.valor - totalGasto)
    };
  });

  const cortesiasFiltradas = cortesiasPorPessoa.filter(p => {
    if (!buscaCortesia.trim()) return true;
    const q = buscaCortesia.toLowerCase();
    return p.clienteNome?.toLowerCase().includes(q) ||
           p.cartaoCodigo?.toLowerCase().includes(q) ||
           p.clienteCpf?.includes(q) ||
           p.clienteCelular?.includes(q);
  });

  // EXPORTAÇÕES EXCLUSIVAS POR TEMA

  // 1. Exportação EXCLUSIVA de Cortesias por Pessoa (PDF)
  function exportarCortesiasPDF() {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(29, 52, 97);
    doc.text("LA MORE EVENTOS", 14, 18);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Relatório Exclusivo de Cortesias e Consumo por Pessoa", 14, 25);
    doc.text(`Período: ${dataInicio || "Todo o período"} até ${dataFim || "Hoje"}`, 14, 31);

    autoTable(doc, {
      startY: 36,
      head: [["Total Concedido", "Pessoas Beneficiadas", "Total Consumido", "Saldo Não Utilizado"]],
      body: [[
        `R$ ${(summary.totalCortesiasValor || 0).toFixed(2).replace('.', ',')}`,
        `${summary.totalCortesiasCartoesQtd || 0} pessoas`,
        `R$ ${(summary.totalCortesiasConsumido || 0).toFixed(2).replace('.', ',')}`,
        `R$ ${Math.max(0, (summary.totalCortesiasValor || 0) - (summary.totalCortesiasConsumido || 0)).toFixed(2).replace('.', ',')}`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    let currentY = doc.lastAutoTable.finalY + 10;

    cortesiasPorPessoa.forEach((pessoa, idx) => {
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(11);
      doc.setTextColor(29, 52, 97);
      doc.setFont("helvetica", "bold");
      doc.text(`${idx + 1}. ${pessoa.clienteNome} — Cartão: ${pessoa.cartaoCodigo}`, 14, currentY);
      
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.setFont("helvetica", "normal");
      doc.text(`Crédito: R$ ${pessoa.valor.toFixed(2).replace('.', ',')} | Consumo: R$ ${pessoa.totalGasto.toFixed(2).replace('.', ',')} | Saldo Restante: R$ ${pessoa.cartaoSaldoAtual.toFixed(2).replace('.', ',')} | Concedido por: ${pessoa.operador}`, 14, currentY + 5);

      if (pessoa.consumos && pessoa.consumos.length > 0) {
        autoTable(doc, {
          startY: currentY + 8,
          head: [["Data/Hora", "Produto Consumido", "Categoria", "Ponto / Atendente", "Valor (R$)"]],
          body: pessoa.consumos.map(c => [
            `${c.data} ${c.hora}`,
            c.produtoNome,
            c.produtoGrupo,
            c.operador,
            `R$ ${c.valor.toFixed(2).replace('.', ',')}`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [29, 52, 97], textColor: [255, 255, 255], fontSize: 8 },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("• Nenhum produto consumido por esta pessoa até o momento.", 16, currentY + 11);
        currentY += 18;
      }
    });

    doc.save("LaMore_Relatorio_Cortesias_Por_Pessoa.pdf");
  }

  // 2. Exportação EXCLUSIVA de Cortesias por Pessoa (Excel)
  async function exportarCortesiasXLSX() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "La More Eventos";
    workbook.created = new Date();

    const wsPessoas = workbook.addWorksheet("Cortesias por Pessoa", { properties: { tabColor: { argb: 'FF8B5CF6' } } });
    wsPessoas.mergeCells('A1:H2');
    const titleCell = wsPessoas.getCell('A1');
    titleCell.value = 'LA MORE EVENTOS - Relatório de Cortesias por Pessoa';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    wsPessoas.getRow(4).values = ["Data/Hora Crédito", "Cliente (Pessoa)", "Código Cartão", "CPF / Celular", "Concedido Por", "Valor Concedido (R$)", "Total Consumido (R$)", "Saldo Atual (R$)"];
    wsPessoas.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsPessoas.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };

    cortesiasPorPessoa.forEach((p, idx) => {
      const row = wsPessoas.addRow([
        `${p.data} ${p.hora}`,
        p.clienteNome,
        p.cartaoCodigo,
        p.clienteCpf || p.clienteCelular || '—',
        p.operador,
        p.valor,
        p.totalGasto,
        p.cartaoSaldoAtual
      ]);
      if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      row.getCell(6).numFmt = '"R$ "#,##0.00';
      row.getCell(7).numFmt = '"R$ "#,##0.00';
      row.getCell(8).numFmt = '"R$ "#,##0.00';
    });

    wsPessoas.columns = [
      { width: 18 }, { width: 25 }, { width: 15 }, { width: 18 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 18 }
    ];

    const wsItens = workbook.addWorksheet("Itens Consumidos (Extrato)", { properties: { tabColor: { argb: 'FF059669' } } });
    wsItens.getRow(1).values = ["Data", "Hora", "Cliente", "Código Cartão", "Produto Consumido", "Categoria", "Ponto / Atendente", "Valor Debitado (R$)"];
    wsItens.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsItens.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

    consumosCortesias.forEach((item, idx) => {
      const row = wsItens.addRow([
        item.data,
        item.hora,
        item.clienteNome,
        item.cartaoCodigo,
        item.produtoNome,
        item.produtoGrupo,
        item.operador,
        item.valor
      ]);
      if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      row.getCell(8).numFmt = '"R$ "#,##0.00';
    });

    wsItens.columns = [
      { width: 14 }, { width: 10 }, { width: 25 }, { width: 15 }, { width: 25 }, { width: 15 }, { width: 20 }, { width: 18 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "LaMore_Relatorio_Cortesias_Por_Pessoa.xlsx");
  }

  // 3. Exportação de Vendas Gerais
  async function exportarVendasXLSX() {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Vendas Gerais");
    ws.getRow(1).values = ["ID", "Data", "Hora", "Cliente", "Item/Ação", "Categoria", "Tipo", "Valor (R$)"];
    ws.getRow(1).font = { bold: true };
    vendasMestre.forEach(v => ws.addRow([v.id, v.data, v.hora, v.cliente, v.produto, v.categoria, v.pagto, v.valor]));
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "LaMore_Vendas_Gerais.xlsx");
  }

  function exportarVendasPDF() {
    const doc = new jsPDF();
    doc.text("Relatório de Vendas Gerais", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [["Data", "Hora", "Cliente", "Produto/Ação", "Valor (R$)"]],
      body: vendasMestre.map(v => [v.data, v.hora, v.cliente, v.produto, v.valor.toFixed(2)]),
      theme: 'striped'
    });
    doc.save("LaMore_Vendas_Gerais.pdf");
  }

  // 4. Exportação Geral BI
  async function exportarGeralXLSX() {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("BI Geral");
    ws.addRow(["Balanço", "Valor (R$)"]);
    ws.addRow(["Total Recarregado", summary.totalRecarregado]);
    ws.addRow(["Total Débito", summary.totalDebito]);
    ws.addRow(["Total Estorno", summary.totalEstorno]);
    ws.addRow(["Saldo em Aberto", summary.saldoEmAberto]);
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "LaMore_Balanço_Geral.xlsx");
  }

  function exportarGeralPDF() {
    const doc = new jsPDF();
    doc.text("Relatório Geral de Balanço (BI)", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [["Balanço", "Valor (R$)"]],
      body: [
        ["Total de Receitas (Recargas)", summary.totalRecarregado.toFixed(2)],
        ["Total de Débitos (Bar/Food)", summary.totalDebito.toFixed(2)],
        ["Total de Devoluções (Estornos)", summary.totalEstorno.toFixed(2)],
        ["Saldo em Aberto (Cartões)", summary.saldoEmAberto.toFixed(2)]
      ]
    });
    doc.save("LaMore_Balanço_Geral.pdf");
  }

  const handleExportarPDF = () => {
    if (aba === "cortesias") return exportarCortesiasPDF();
    if (aba === "vendas") return exportarVendasPDF();
    return exportarGeralPDF();
  };

  const handleExportarXLSX = () => {
    if (aba === "cortesias") return exportarCortesiasXLSX();
    if (aba === "vendas") return exportarVendasXLSX();
    return exportarGeralXLSX();
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Header e Filtros */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
        <div>
          <h2 className="text-4xl font-black text-[#1D3461]">Relatórios e BI</h2>
          <p className="text-gray-500 text-lg font-semibold mt-1">Dados consolidados do evento</p>
        </div>
        
        <div className="flex flex-wrap items-end gap-4">
          {session?.user?.role === 'MASTER' && eventos.length > 0 && (
            <div className="min-w-[220px]">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Filtrar por Evento</label>
              <select
                value={eventoId || ""}
                onChange={(e) => {
                  setEventoId(e.target.value);
                  localStorage.setItem("activeEventoId", e.target.value);
                }}
                className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#1D3461] rounded-xl px-4 py-2 font-bold text-[#1D3461] outline-none transition-all"
              >
                {eventos.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Data Inicial</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2 font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"/>
            </div>
            <span className="text-gray-300 font-bold mb-2">-</span>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Data Final</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2 font-semibold text-gray-900 focus:outline-none focus:border-[#1D3461]"/>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={handleExportarXLSX} className="bg-green-600 text-white font-black text-sm px-5 py-3 rounded-xl hover:bg-green-700 transition-all flex items-center gap-2 shadow-sm cursor-pointer">
              <span>📊</span> {aba === 'cortesias' ? 'Excel (Cortesias)' : aba === 'vendas' ? 'Excel (Vendas)' : 'Excel (.xlsx)'}
            </button>
            <button onClick={handleExportarPDF} className="bg-red-600 text-white font-black text-sm px-5 py-3 rounded-xl hover:bg-red-700 transition-all flex items-center gap-2 shadow-sm cursor-pointer">
              <span>📄</span> {aba === 'cortesias' ? 'PDF (Cortesias)' : aba === 'vendas' ? 'PDF (Vendas)' : 'PDF (.pdf)'}
            </button>
          </div>
        </div>
      </div>

      {/* Navegação de Abas */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: "bi", label: "📈 Visão Geral (BI)" },
          { id: "vendas", label: "🧾 Vendas Gerais (Tabela)" },
          { id: "produtos", label: "🍔 Produtos" },
          { id: "recebimentos", label: "💳 Recebimentos" },
          { id: "cortesias", label: "🎁 Cortesias por Pessoa" },
        ].map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`px-6 py-4 rounded-2xl font-black text-lg whitespace-nowrap transition-all cursor-pointer ${
              aba === a.id ? "bg-[#1D3461] text-white shadow-lg" : "bg-white text-gray-500 border-2 border-gray-100 hover:border-gray-300"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* ABA: CORTESIAS POR PESSOA */}
      {aba === "cortesias" && (
        <div className="space-y-6">
          {/* KPI Cards de Cortesia */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-purple-50 border-2 border-purple-100 rounded-3xl p-6">
              <span className="text-4xl block mb-2">🎁</span>
              <p className="text-3xl font-black text-purple-700">R$ {(summary.totalCortesiasValor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-purple-600 font-bold text-sm mt-1">Total Concedido em Cortesia</p>
            </div>
            <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-6">
              <span className="text-4xl block mb-2">👥</span>
              <p className="text-3xl font-black text-blue-700">{summary.totalCortesiasCartoesQtd || 0}</p>
              <p className="text-blue-600 font-bold text-sm mt-1">Pessoas Beneficiadas</p>
            </div>
            <div className="bg-emerald-50 border-2 border-emerald-100 rounded-3xl p-6">
              <span className="text-4xl block mb-2">🍔</span>
              <p className="text-3xl font-black text-emerald-700">R$ {(summary.totalCortesiasConsumido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-emerald-600 font-bold text-sm mt-1">Total Consumido em Produtos</p>
            </div>
            <div className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-6">
              <span className="text-4xl block mb-2">⏳</span>
              <p className="text-3xl font-black text-amber-700">
                R$ {Math.max(0, (summary.totalCortesiasValor || 0) - (summary.totalCortesiasConsumido || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-amber-600 font-bold text-sm mt-1">Saldo Restante não Utilizado</p>
            </div>
          </div>

          {/* Barra de Busca Exclusiva de Cortesias e Ações de Exportação */}
          <div className="bg-white p-5 rounded-3xl border-2 border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-auto flex-1">
              <input
                type="text"
                value={buscaCortesia}
                onChange={(e) => setBuscaCortesia(e.target.value)}
                placeholder="🔍 Filtrar cortesia por nome da pessoa, código do cartão ou CPF..."
                className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#1D3461] rounded-2xl px-5 py-3 font-semibold text-gray-900 outline-none"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                onClick={exportarCortesiasXLSX}
                className="flex-1 md:flex-none bg-green-700 hover:bg-green-800 text-white font-black text-sm px-5 py-3 rounded-2xl transition-all shadow-sm flex items-center gap-2 justify-center cursor-pointer"
              >
                <span>📊</span> Baixar Planilha (.xlsx)
              </button>
              <button 
                onClick={exportarCortesiasPDF}
                className="flex-1 md:flex-none bg-red-700 hover:bg-red-800 text-white font-black text-sm px-5 py-3 rounded-2xl transition-all shadow-sm flex items-center gap-2 justify-center cursor-pointer"
              >
                <span>📄</span> Baixar PDF (.pdf)
              </button>
            </div>
          </div>

          {/* Lista de Cortesias Agrupadas por Pessoa */}
          {cortesiasFiltradas.length === 0 ? (
            <div className="bg-white rounded-3xl border-2 border-gray-100 p-12 text-center">
              <p className="text-gray-400 font-bold text-lg">Nenhuma cortesia encontrada com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {cortesiasFiltradas.map((pessoa, idx) => (
                <div key={pessoa.id || idx} className="bg-white rounded-3xl border-2 border-gray-100 shadow-sm overflow-hidden">
                  {/* Cabeçalho da Pessoa */}
                  <div className="p-6 bg-gradient-to-r from-purple-900 to-[#1D3461] text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-black shrink-0">
                        👤
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-black">{pessoa.clienteNome}</h3>
                          <span className="bg-purple-400/20 text-purple-200 border border-purple-400/30 text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg">
                            Cartão: {pessoa.cartaoCodigo}
                          </span>
                        </div>
                        <p className="text-blue-200 text-xs font-semibold mt-1">
                          Concedido em {pessoa.data} às {pessoa.hora} por <b>{pessoa.operador}</b> {pessoa.clienteCpf && `• CPF: ${pessoa.clienteCpf}`}
                        </p>
                      </div>
                    </div>

                    {/* Resumo Financeiro da Pessoa */}
                    <div className="flex flex-wrap items-center gap-3 bg-black/20 p-3 rounded-2xl border border-white/10">
                      <div className="text-center px-3">
                        <p className="text-[10px] uppercase font-bold text-purple-200">Cortesia Total</p>
                        <p className="text-lg font-black text-purple-300">R$ {pessoa.valor.toFixed(2).replace('.', ',')}</p>
                      </div>
                      <div className="w-px h-8 bg-white/20"></div>
                      <div className="text-center px-3">
                        <p className="text-[10px] uppercase font-bold text-emerald-200">Consumido</p>
                        <p className="text-lg font-black text-emerald-400">R$ {pessoa.totalGasto.toFixed(2).replace('.', ',')}</p>
                      </div>
                      <div className="w-px h-8 bg-white/20"></div>
                      <div className="text-center px-3">
                        <p className="text-[10px] uppercase font-bold text-amber-200">Saldo Restante</p>
                        <p className="text-lg font-black text-amber-300">R$ {pessoa.cartaoSaldoAtual.toFixed(2).replace('.', ',')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Extrato de Itens Consumidos pela Pessoa */}
                  <div className="p-6">
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>🍔</span> Extrato de Consumo ({pessoa.consumos.length} {pessoa.consumos.length === 1 ? 'item' : 'itens'})
                    </h4>

                    {pessoa.consumos.length === 0 ? (
                      <div className="p-6 bg-gray-50 rounded-2xl text-center border-2 border-dashed border-gray-200">
                        <p className="text-gray-400 font-bold text-sm">Esta pessoa ainda não realizou consumos nos bares ou barracas com este cartão.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-gray-100">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-gray-50 text-gray-400 text-xs uppercase font-black">
                              <th className="p-3">Data / Hora</th>
                              <th className="p-3">Produto Consumido</th>
                              <th className="p-3">Categoria</th>
                              <th className="p-3">Ponto / Atendente</th>
                              <th className="p-3 text-right">Valor Debitado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {pessoa.consumos.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                                <td className="p-3 text-xs font-bold text-gray-500 whitespace-nowrap">{item.data} {item.hora}</td>
                                <td className="p-3 text-sm font-black text-gray-900">{item.produtoNome}</td>
                                <td className="p-3 text-xs font-semibold text-gray-500 uppercase">{item.produtoGrupo}</td>
                                <td className="p-3 text-xs font-semibold text-gray-600">{item.operador}</td>
                                <td className="p-3 text-sm font-black text-gray-900 text-right">R$ {item.valor.toFixed(2).replace('.', ',')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA: VISÃO GERAL (BI) */}
      {aba === "bi" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-green-50 border-2 border-green-100 rounded-3xl p-6">
              <span className="text-4xl block mb-2">💰</span>
              <p className="text-4xl font-black text-green-700">R$ {summary.totalRecarregado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-green-600 font-bold text-lg mt-1">Total Recebido (Recargas)</p>
            </div>
            <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-6">
              <span className="text-4xl block mb-2">🍔</span>
              <p className="text-4xl font-black text-blue-700">R$ {summary.totalDebito.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-blue-600 font-bold text-lg mt-1">Total Consumido (Produtos)</p>
            </div>
            <div className="bg-yellow-50 border-2 border-yellow-100 rounded-3xl p-6">
              <span className="text-4xl block mb-2">⏳</span>
              <p className="text-4xl font-black text-yellow-700">R$ {summary.saldoEmAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-yellow-600 font-bold text-lg mt-1">Saldo em Aberto (Cartões)</p>
            </div>
            <div className="bg-purple-50 border-2 border-purple-100 rounded-3xl p-6">
              <span className="text-4xl block mb-2">💳</span>
              <p className="text-4xl font-black text-purple-700">{summary.totalCartoes}</p>
              <p className="text-purple-600 font-bold text-lg mt-1">Total de Cartões Emitidos</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border-2 border-gray-100 p-8 shadow-sm h-[400px]">
              <h3 className="text-2xl font-black text-[#1D3461] mb-6">Faturamento por Categoria (R$)</h3>
              {vendasPorGrupo.length === 0 ? (
                <p className="text-center text-gray-400 font-bold py-12">Nenhuma venda registrada por categoria.</p>
              ) : (
                <ResponsiveContainer width="100%" height="80%">
                  <BarChart data={vendasPorGrupo}>
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {vendasPorGrupo.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_GRUPO[index % COLORS_GRUPO.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-3xl border-2 border-gray-100 p-8 shadow-sm h-[400px]">
              <h3 className="text-2xl font-black text-[#1D3461] mb-6">Fluxo de Consumo por Hora</h3>
              {vendasPorHora.length === 0 ? (
                <p className="text-center text-gray-400 font-bold py-12">Nenhum dado horário disponível.</p>
              ) : (
                <ResponsiveContainer width="100%" height="80%">
                  <BarChart data={vendasPorHora}>
                    <XAxis dataKey="hora" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="valor" fill="#3B82F6" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA: VENDAS GERAIS */}
      {aba === "vendas" && (
        <div className="bg-white rounded-3xl border-2 border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-[#1D3461] text-white flex justify-between items-center">
            <h3 className="text-2xl font-black">Extrato Detalhado de Vendas</h3>
            <span className="bg-white/20 text-white font-bold px-3 py-1 rounded-xl text-sm">{vendasMestre.length} registros</span>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-100 z-10">
                <tr>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs">Data & Hora</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs">Cliente</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs">Item / Ação</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs">Categoria</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs">Operador</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs">Tipo</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendasMestre.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400 font-bold">Nenhuma transação encontrada.</td></tr>
                ) : (
                  vendasMestre.map(v => (
                    <tr key={v.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="p-4 font-bold text-gray-600 text-sm whitespace-nowrap">{v.data} {v.hora}</td>
                      <td className="p-4 font-black text-gray-900">{v.cliente}</td>
                      <td className="p-4 font-bold text-blue-900">{v.produto}</td>
                      <td className="p-4 text-xs font-semibold text-gray-500 uppercase">{v.categoria}</td>
                      <td className="p-4 text-sm font-semibold text-gray-600">{v.operador}</td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${v.pagto === 'Entrada' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {v.pagto}
                        </span>
                      </td>
                      <td className={`p-4 font-black text-right ${v.pagto === 'Entrada' ? 'text-green-600' : 'text-gray-900'}`}>
                        R$ {v.valor.toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA: PRODUTOS */}
      {aba === "produtos" && (
        <div className="bg-white rounded-3xl border-2 border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-[#1D3461] text-white flex justify-between items-center">
            <h3 className="text-2xl font-black">Ranking de Vendas por Produto</h3>
            <span className="bg-white/20 text-white font-bold px-3 py-1 rounded-xl text-sm">{vendasPorProduto.length} itens</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-100">
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs">Produto</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs text-center">Quantidade Vendida</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs text-right">Faturamento Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendasPorProduto.map((p, idx) => (
                  <tr key={p.name} className="hover:bg-blue-50/50 transition-colors">
                    <td className="p-4 font-black text-gray-900">{idx + 1}. {p.name}</td>
                    <td className="p-4 font-black text-[#1D3461] text-center">{p.qtd}</td>
                    <td className="p-4 font-black text-gray-900 text-right">
                      R$ {p.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      <span className="text-xs text-gray-400 ml-2 font-bold">
                        ({summary.totalDebito > 0 ? ((p.value / summary.totalDebito) * 100).toFixed(1) : 0}%)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA: RECEBIMENTOS */}
      {aba === "recebimentos" && (
        <div className="bg-white rounded-3xl border-2 border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-[#1D3461] text-white flex justify-between items-center">
            <h3 className="text-2xl font-black">Origem das Recargas (Formas de Pagamento)</h3>
            <span className="bg-white/20 text-white font-bold px-3 py-1 rounded-xl text-sm">{recebimentos.length} formas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-100">
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs">Forma de Pagamento</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs text-center">Transações</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs text-right">Faturamento Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recebimentos.map((r) => (
                  <tr key={r.name} className="hover:bg-blue-50/50 transition-colors">
                    <td className="p-4 font-black text-gray-900 flex items-center gap-2">
                      <span>{r.name === 'Pix' ? '⚡' : r.name === 'Cortesia' ? '🎁' : r.name === 'Dinheiro' ? '💵' : '💳'}</span>
                      {r.name}
                    </td>
                    <td className="p-4 font-black text-[#1D3461] text-center">{r.qtd}</td>
                    <td className="p-4 font-black text-gray-900 text-right">
                      R$ {r.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      <span className="text-xs text-gray-400 ml-2 font-bold">
                        ({summary.totalRecarregado > 0 ? ((r.value / summary.totalRecarregado) * 100).toFixed(1) : 0}%)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
