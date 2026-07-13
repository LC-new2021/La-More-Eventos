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
const COLORS_PAGTO = ["#10B981", "#3B82F6", "#F59E0B"];

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

export default function RelatoriosPage() {
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aba, setAba] = useState("bi"); // bi | vendas | produtos | recebimentos
  const [dataInicio, setDataInicio] = useState(getTodayBR());
  const [dataFim, setDataFim] = useState(getTodayBR());

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
        <p className="text-red-500 font-bold text-xl">Este usuário organizador não está vinculado a um evento.</p>
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

  const { summary, vendasPorGrupo, vendasPorProduto, vendasPorHora, recebimentos, vendasMestre } = data || {
    summary: { totalRecarregado: 0, totalDebito: 0, totalEstorno: 0, saldoEmAberto: 0, totalCartoes: 0, totalPedidos: 0, ticketMedio: 0 },
    vendasPorGrupo: [],
    vendasPorProduto: [],
    vendasPorHora: [],
    recebimentos: [],
    vendasMestre: []
  };

  // Filter list by date range if provided
  const filteredVendasMestre = vendasMestre.filter(v => {
    if (!v.data) return true;
    const parts = v.data.split("/");
    const dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
    if (dataInicio && dateObj < new Date(dataInicio)) return false;
    if (dataFim && dateObj > new Date(dataFim)) return false;
    return true;
  });

  async function exportarXLSX() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "La More Eventos";
    workbook.created = new Date();

    const wsGeral = workbook.addWorksheet("Vendas Gerais", { properties: { tabColor: { argb: 'FF1D3461' } } });
    wsGeral.mergeCells('A1:G2');
    const titleCell = wsGeral.getCell('A1');
    titleCell.value = 'LA MORE EVENTOS - Relatório de Transações';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    wsGeral.getCell('A3').value = `Período: ${dataInicio || "Todo o período"} até ${dataFim || "Hoje"}`;
    wsGeral.getCell('A3').font = { italic: true };

    const headerRow = wsGeral.getRow(5);
    headerRow.values = ["ID", "Data", "Hora", "Cliente", "Item/Ação", "Categoria", "Tipo", "Valor (R$)"];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
    headerRow.alignment = { horizontal: 'center' };

    filteredVendasMestre.forEach((v, index) => {
      const row = wsGeral.addRow([v.id, v.data, v.hora, v.cliente, v.produto, v.categoria, v.pagto, v.valor]);
      if (index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      row.getCell(8).numFmt = '"R$ "#,##0.00';
    });

    wsGeral.columns = [
      { width: 15 }, { width: 15 }, { width: 10 }, { width: 25 }, 
      { width: 30 }, { width: 20 }, { width: 20 }, { width: 15 }
    ];

    const wsProdutos = workbook.addWorksheet("Produtos", { properties: { tabColor: { argb: 'FF10B981' } } });
    wsProdutos.getRow(1).values = ["Produto", "Quantidade", "Faturamento (R$)"];
    wsProdutos.getRow(1).font = { bold: true };
    vendasPorProduto.forEach((p) => wsProdutos.addRow([p.name, p.qtd, p.value]));

    const wsRecebimentos = workbook.addWorksheet("Recebimentos", { properties: { tabColor: { argb: 'FFF59E0B' } } });
    wsRecebimentos.getRow(1).values = ["Forma de Pagamento", "Qtd de Transações", "Faturamento (R$)"];
    wsRecebimentos.getRow(1).font = { bold: true };
    recebimentos.forEach((r) => wsRecebimentos.addRow([r.name, r.qtd, r.value]));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "LaMore_Relatorio_Geral.xlsx");
  }

  function exportarPDF() {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(29, 52, 97);
    doc.text("LA MORE EVENTOS", 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Relatório Geral Consolidado do Evento`, 14, 28);
    doc.text(`Filtro: ${dataInicio || "Início"} até ${dataFim || "Fim"}`, 14, 34);

    doc.setFontSize(14);
    doc.setTextColor(50);
    doc.text("Resumo de Balanço Geral", 14, 45);

    autoTable(doc, {
      startY: 48,
      head: [["Balanço", "Faturamento (R$)"]],
      body: [
        ["Total de Receitas (Recargas)", summary.totalRecarregado.toFixed(2)],
        ["Total de Débitos (Bar/Food)", summary.totalDebito.toFixed(2)],
        ["Total de Devoluções (Estornos)", summary.totalEstorno.toFixed(2)],
        ["Saldo em Aberto (Cartões)", summary.saldoEmAberto.toFixed(2)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [29, 52, 97], textColor: [255, 255, 255] },
    });

    let nextY = doc.lastAutoTable.finalY + 15;
    doc.text("Extrato de Transações Recentes", 14, nextY);

    autoTable(doc, {
      startY: nextY + 3,
      head: [["Data", "Hora", "Cliente", "Produto/Ação", "Valor (R$)"]],
      body: filteredVendasMestre.slice(0, 50).map(v => [v.data, v.hora, v.cliente, v.produto, v.valor.toFixed(2)]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
      styles: { fontSize: 8 }
    });

    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(50);
    doc.text("Relatório de Produtos", 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [["Produto", "Qtd", "Faturamento (R$)"]],
      body: vendasPorProduto.map(p => [p.name, p.qtd, p.value.toFixed(2)]),
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] }
    });

    let posY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setTextColor(50);
    doc.text("Origem das Recargas (Recebimentos)", 14, posY);
    autoTable(doc, {
      startY: posY + 3,
      head: [["Forma de Pagamento", "Qtd", "Faturamento (R$)"]],
      body: recebimentos.map(r => [r.name, r.qtd, r.value.toFixed(2)]),
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255] }
    });

    doc.save(`LaMoreEventos_Relatorio.pdf`);
  }

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Header e Filtros */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
        <div>
          <h2 className="text-4xl font-black text-[#1D3461]">Relatórios e BI</h2>
          <p className="text-gray-500 text-lg font-semibold mt-1">Dados consolidados do evento</p>
        </div>
        
        <div className="flex flex-wrap items-end gap-4">
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
            <button onClick={exportarXLSX} className="bg-green-600 text-white font-black text-sm px-5 py-3 rounded-xl hover:bg-green-700 transition-all flex items-center gap-2">
              <span>📊</span> Planilha Excel
            </button>
            <button onClick={exportarPDF} className="bg-red-600 text-white font-black text-sm px-5 py-3 rounded-xl hover:bg-red-700 transition-all flex items-center gap-2">
              <span>📄</span> Baixar PDF
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
        ].map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`px-6 py-4 rounded-2xl font-black text-lg whitespace-nowrap transition-all ${
              aba === a.id ? "bg-[#1D3461] text-white shadow-lg" : "bg-white text-gray-500 border-2 border-gray-100 hover:border-gray-300"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

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
              <span className="text-4xl block mb-2">🧾</span>
              <p className="text-4xl font-black text-blue-700">R$ {summary.totalDebito.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-blue-600 font-bold text-lg mt-1">Total Consumido (Bares)</p>
            </div>
            <div className="bg-yellow-50 border-2 border-yellow-100 rounded-3xl p-6">
              <span className="text-4xl block mb-2">⏳</span>
              <p className="text-4xl font-black text-yellow-700">R$ {summary.saldoEmAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-yellow-600 font-bold text-lg mt-1">Saldo em Aberto (Cartões)</p>
            </div>
            <div className="bg-red-50 border-2 border-red-100 rounded-3xl p-6">
              <span className="text-4xl block mb-2">💸</span>
              <p className="text-4xl font-black text-red-700">R$ {summary.totalEstorno.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-red-600 font-bold text-lg mt-1">Total Devolvido (Estornos)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-purple-50 border-2 border-purple-100 rounded-3xl p-5 flex items-center justify-between">
              <div>
                <p className="text-purple-600 font-bold text-sm uppercase tracking-widest">Cartões Emitidos</p>
                <p className="text-3xl font-black text-purple-700 mt-1">{summary.totalCartoes}</p>
              </div>
              <span className="text-5xl opacity-50">💳</span>
            </div>
            <div className="bg-gray-50 border-2 border-gray-200 rounded-3xl p-5 flex items-center justify-between">
              <div>
                <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">Ticket Médio</p>
                <p className="text-3xl font-black text-gray-800 mt-1">R$ {summary.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <span className="text-5xl opacity-50">📊</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border-2 border-gray-100 p-8 shadow-sm h-[400px]">
              <h3 className="text-2xl font-black text-[#1D3461] mb-6 flex items-center gap-3">
                <span>📈</span> Volume de Vendas por Hora
              </h3>
              {vendasPorHora.length === 0 ? (
                <p className="text-center text-gray-400 font-bold py-12">Nenhuma venda realizada.</p>
              ) : (
                <ResponsiveContainer width="100%" height="80%">
                  <BarChart data={vendasPorHora} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="hora" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 'bold' }} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      tickFormatter={(val) => val >= 1000 ? `R$ ${(val/1000).toFixed(1).replace('.',',')}k` : `R$ ${val}`} 
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="valor" fill="#1D3461" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-3xl border-2 border-gray-100 p-8 shadow-sm h-[400px]">
              <h3 className="text-2xl font-black text-[#1D3461] mb-6 flex items-center gap-3">
                <span>💳</span> Formas de Recebimento
              </h3>
              {recebimentos.length === 0 ? (
                <p className="text-center text-gray-400 font-bold py-12">Sem recargas registradas.</p>
              ) : (
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie 
                      data={recebimentos.map(r => ({...r, percent: summary.totalRecarregado > 0 ? ((r.value/summary.totalRecarregado)*100).toFixed(1) : 0}))} 
                      cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value"
                    >
                      {recebimentos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_PAGTO[index % COLORS_PAGTO.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontWeight: 'bold', color: '#374151' }} />
                  </PieChart>
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
            <p className="font-semibold text-blue-200">Exibindo {filteredVendasMestre.length} transações</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-100">
                  <th className="p-4 font-bold text-gray-400 uppercase text-sm tracking-wider">Hora</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-sm tracking-wider">Produto/Ação</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-sm tracking-wider">Categoria</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-sm tracking-wider">Cliente</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-sm tracking-wider">Operador</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-sm tracking-wider">Forma Pagto</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-sm tracking-wider text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVendasMestre.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 font-bold">Nenhum registro encontrado.</td>
                  </tr>
                ) : (
                  filteredVendasMestre.map((v) => (
                    <tr key={v.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="p-4 font-bold text-gray-900">{v.data} {v.hora}</td>
                      <td className="p-4 font-black text-[#1D3461]">{v.produto}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          v.categoria === "Recarga" ? "bg-green-100 text-green-700" :
                          v.categoria === "Bebidas" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {v.categoria}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-gray-600">{v.cliente}</td>
                      <td className="p-4 font-semibold text-gray-600">{v.operador}</td>
                      <td className="p-4 font-semibold text-gray-600">{v.pagto}</td>
                      <td className="p-4 font-black text-gray-900 text-right">R$ {v.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA: RECEBIMENTOS */}
      {aba === "recebimentos" && (
        <div className="bg-white rounded-3xl border-2 border-gray-100 p-8 shadow-sm">
          <h3 className="text-2xl font-black text-[#1D3461] mb-6">Origem das Recargas</h3>
          {recebimentos.length === 0 ? (
            <p className="text-center text-gray-400 font-bold py-12">Sem dados de recarga disponíveis.</p>
          ) : (
            <div className="space-y-6">
              {recebimentos.map((r, index) => (
                <div key={r.name}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-black text-gray-900 text-xl">{r.name}</p>
                    <div className="text-right">
                      <p className="font-black text-[#1D3461] text-2xl">
                        R$ {r.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        <span className="text-sm text-gray-500 ml-2 font-bold">({summary.totalRecarregado > 0 ? ((r.value / summary.totalRecarregado) * 100).toFixed(1) : 0}%)</span>
                      </p>
                      <p className="text-gray-400 text-sm font-semibold">{r.qtd} transações</p>
                    </div>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${summary.totalRecarregado > 0 ? (r.value / summary.totalRecarregado) * 100 : 0}%`, backgroundColor: COLORS_PAGTO[index] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA: PRODUTOS */}
      {aba === "produtos" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border-2 border-gray-100 p-8 shadow-sm">
              <h3 className="text-2xl font-black text-[#1D3461] mb-6">Desempenho por Categoria</h3>
              {vendasPorGrupo.length === 0 ? (
                <p className="text-center text-gray-400 font-bold py-12">Nenhuma venda realizada por categoria.</p>
              ) : (
                <div className="space-y-6">
                  {vendasPorGrupo.map((g, index) => (
                    <div key={g.name}>
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-black text-gray-900 text-xl">{g.name}</p>
                        <div className="text-right">
                          <p className="font-black text-[#1D3461] text-2xl">
                            R$ {g.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            <span className="text-sm text-gray-500 ml-2 font-bold">({summary.totalDebito > 0 ? ((g.value / summary.totalDebito) * 100).toFixed(1) : 0}%)</span>
                          </p>
                          <p className="text-gray-400 text-sm font-semibold">{g.qtd} pedidos</p>
                        </div>
                      </div>
                      <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${summary.totalDebito > 0 ? (g.value / summary.totalDebito) * 100 : 0}%`, backgroundColor: COLORS_GRUPO[index % COLORS_GRUPO.length] }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-3xl border-2 border-gray-100 p-8 shadow-sm h-[400px]">
               <h3 className="text-2xl font-black text-[#1D3461] mb-6">Participação de Vendas</h3>
               {vendasPorGrupo.length === 0 ? (
                 <p className="text-center text-gray-400 font-bold py-12">Sem dados de participação.</p>
               ) : (
                  <ResponsiveContainer width="100%" height="80%">
                    <PieChart>
                      <Pie 
                        data={vendasPorGrupo.map(v => ({...v, percent: summary.totalDebito > 0 ? ((v.value/summary.totalDebito)*100).toFixed(1) : 0}))} 
                        cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value"
                      >
                        {vendasPorGrupo.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS_GRUPO[index % COLORS_GRUPO.length]} />))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontWeight: 'bold', color: '#374151' }} />
                    </PieChart>
                  </ResponsiveContainer>
               )}
            </div>
          </div>
          
          {vendasPorProduto.length > 0 && (
            <div className="mt-6 bg-white rounded-3xl border-2 border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 bg-[#1D3461] text-white flex justify-between items-center">
                <h3 className="text-2xl font-black">Ranking de Produtos (Tabela)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-100">
                      <th className="p-4 font-bold text-gray-400 uppercase text-sm tracking-wider">Produto</th>
                      <th className="p-4 font-bold text-gray-400 uppercase text-sm tracking-wider text-center">Quantidade Vendida</th>
                      <th className="p-4 font-bold text-gray-400 uppercase text-sm tracking-wider text-right">Faturamento Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vendasPorProduto.map((p, idx) => (
                      <tr key={p.name} className="hover:bg-blue-50/50 transition-colors">
                        <td className="p-4 font-bold text-gray-900">{idx + 1}. {p.name}</td>
                        <td className="p-4 font-black text-[#1D3461] text-center">{p.qtd}</td>
                        <td className="p-4 font-black text-gray-900 text-right">
                          R$ {p.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-sm text-gray-500 ml-2 font-bold">({summary.totalDebito > 0 ? ((p.value / summary.totalDebito) * 100).toFixed(1) : 0}%)</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
