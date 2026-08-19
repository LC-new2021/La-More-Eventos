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

  const { summary, vendasPorGrupo, vendasPorProduto, vendasPorHora, recebimentos, vendasMestre, cortesiasConsolidadas = [] } = data || {
    summary: { totalRecarregado: 0, totalDebito: 0, totalEstorno: 0, saldoEmAberto: 0, totalCartoes: 0, totalPedidos: 0, ticketMedio: 0, totalCortesiasValor: 0, totalCortesiasConsumido: 0, totalCortesiasDevolvido: 0, totalCortesiasCartoesQtd: 0 },
    vendasPorGrupo: [],
    vendasPorProduto: [],
    vendasPorHora: [],
    recebimentos: [],
    vendasMestre: [],
    cortesiasConsolidadas: []
  };

  const cortesiasFiltradas = cortesiasConsolidadas.filter(p => {
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
    doc.text("Relatório Consolidado de Cortesias por Pessoa", 14, 25);
    doc.text(`Período: ${dataInicio || "Todo o período"} até ${dataFim || "Hoje"}`, 14, 31);

    autoTable(doc, {
      startY: 36,
      head: [["Total Concedido", "Pessoas Beneficiadas", "Total Consumido", "Total Devolvido", "Saldo Restante"]],
      body: [[
        `R$ ${(summary.totalCortesiasValor || 0).toFixed(2).replace('.', ',')}`,
        `${summary.totalCortesiasCartoesQtd || 0} pessoas`,
        `R$ ${(summary.totalCortesiasConsumido || 0).toFixed(2).replace('.', ',')}`,
        `R$ ${(summary.totalCortesiasDevolvido || 0).toFixed(2).replace('.', ',')}`,
        `R$ ${Math.max(0, (summary.totalCortesiasValor || 0) - (summary.totalCortesiasConsumido || 0) - (summary.totalCortesiasDevolvido || 0)).toFixed(2).replace('.', ',')}`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    let currentY = doc.lastAutoTable.finalY + 10;

    cortesiasConsolidadas.forEach((pessoa, idx) => {
      if (currentY > 230) {
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
      
      let infoText = `Cortesia Concedida: R$ ${pessoa.totalCortesiaConcedida.toFixed(2).replace('.', ',')}`;
      if (pessoa.totalRecargasPagas > 0) {
        infoText += ` | Recarga Própria: R$ ${pessoa.totalRecargasPagas.toFixed(2).replace('.', ',')} (Total: R$ ${pessoa.totalCreditosCartao.toFixed(2).replace('.', ',')})`;
      }
      infoText += ` | Consumo: R$ ${pessoa.totalConsumido.toFixed(2).replace('.', ',')}`;
      if (pessoa.totalDevolvido > 0) {
        infoText += ` | Devolvido: R$ ${pessoa.totalDevolvido.toFixed(2).replace('.', ',')}`;
      }
      infoText += ` | Saldo Restante: R$ ${pessoa.saldoRestante.toFixed(2).replace('.', ',')}`;
      doc.text(infoText, 14, currentY + 5);

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
        currentY = doc.lastAutoTable.finalY + 8;
      } else {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("• Nenhum produto consumido por esta pessoa até o momento.", 16, currentY + 11);
        currentY += 16;
      }

      if (pessoa.devolucoes && pessoa.devolucoes.length > 0) {
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        autoTable(doc, {
          startY: currentY,
          head: [["Data/Hora Devolução", "Tipo / Motivo", "Operador", "Valor Estornado (R$)"]],
          body: pessoa.devolucoes.map(d => [
            `${d.data} ${d.hora}`,
            d.descricao || 'Devolução de Saldo',
            d.operador,
            `R$ ${d.valor.toFixed(2).replace('.', ',')}`
          ]),
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontSize: 8 },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 10;
      }
    });

    doc.save("LaMore_Relatorio_Cortesias_Por_Pessoa.pdf");
  }

  // 2. Exportação EXCLUSIVA de Cortesias por Pessoa (Excel)
  async function exportarCortesiasXLSX() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "La More Eventos";
    workbook.created = new Date();

    // Aba 1: Resumo Consolidado por Pessoa
    const wsPessoas = workbook.addWorksheet("Cortesias por Pessoa", { properties: { tabColor: { argb: 'FF8B5CF6' } } });
    wsPessoas.mergeCells('A1:J2');
    const titleCell = wsPessoas.getCell('A1');
    titleCell.value = 'LA MORE EVENTOS - Relatório Consolidado de Cortesias por Pessoa';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    wsPessoas.getRow(4).values = [
      "Cliente (Pessoa)", 
      "Código Cartão", 
      "CPF / Celular", 
      "Operador Principal", 
      "Cortesia Concedida (R$)", 
      "Recargas Próprias (R$)",
      "Total Créditos no Cartão (R$)", 
      "Total Consumido (R$)", 
      "Total Devolvido (R$)", 
      "Saldo Restante (R$)"
    ];
    wsPessoas.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsPessoas.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };

    cortesiasConsolidadas.forEach((p, idx) => {
      const row = wsPessoas.addRow([
        p.clienteNome,
        p.cartaoCodigo,
        p.clienteCpf || p.clienteCelular || '—',
        p.operadorPrincipal,
        p.totalCortesiaConcedida,
        p.totalRecargasPagas,
        p.totalCreditosCartao,
        p.totalConsumido,
        p.totalDevolvido,
        p.saldoRestante
      ]);
      if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      row.getCell(5).numFmt = '"R$ "#,##0.00';
      row.getCell(6).numFmt = '"R$ "#,##0.00';
      row.getCell(7).numFmt = '"R$ "#,##0.00';
      row.getCell(8).numFmt = '"R$ "#,##0.00';
      row.getCell(9).numFmt = '"R$ "#,##0.00';
      row.getCell(10).numFmt = '"R$ "#,##0.00';
    });

    wsPessoas.columns = [
      { width: 25 }, { width: 15 }, { width: 18 }, { width: 20 }, { width: 22 }, { width: 22 }, { width: 25 }, { width: 20 }, { width: 20 }, { width: 20 }
    ];

    // Aba 2: Itens Consumidos
    const wsItens = workbook.addWorksheet("Itens Consumidos", { properties: { tabColor: { argb: 'FF059669' } } });
    wsItens.getRow(1).values = ["Data", "Hora", "Cliente", "Código Cartão", "Produto Consumido", "Categoria", "Ponto / Atendente", "Valor Debitado (R$)"];
    wsItens.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsItens.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

    let totalItemIdx = 0;
    cortesiasConsolidadas.forEach(p => {
      p.consumos.forEach(item => {
        const row = wsItens.addRow([
          item.data,
          item.hora,
          p.clienteNome,
          p.cartaoCodigo,
          item.produtoNome,
          item.produtoGrupo,
          item.operador,
          item.valor
        ]);
        if (totalItemIdx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        row.getCell(8).numFmt = '"R$ "#,##0.00';
        totalItemIdx++;
      });
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
    workbook.creator = "La More Eventos";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Vendas Gerais", { properties: { tabColor: { argb: 'FF1D3461' } } });

    ws.mergeCells('A1:H2');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'LA MORE EVENTOS - Extrato Completo de Vendas Gerais';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.getCell('A3').value = `Período: ${dataInicio || "Todo o período"} até ${dataFim || "Hoje"} | Total de Movimentações: ${vendasMestre.length}`;
    ws.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF4B5563' } };

    const headerRow = ws.getRow(5);
    headerRow.values = ["Data", "Hora", "Cliente", "Item / Ação / Produto", "Categoria", "Operador / Caixa", "Tipo", "Valor (R$)"];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };

    ws.columns = [
      { key: "data", width: 14 },
      { key: "hora", width: 10 },
      { key: "cliente", width: 26 },
      { key: "produto", width: 30 },
      { key: "categoria", width: 18 },
      { key: "operador", width: 22 },
      { key: "tipo", width: 18 },
      { key: "valor", width: 16 }
    ];

    vendasMestre.forEach((v, idx) => {
      const row = ws.addRow({
        data: v.data,
        hora: v.hora,
        cliente: v.cliente,
        produto: v.produto,
        categoria: v.categoria,
        operador: v.operador,
        tipo: v.pagto,
        valor: v.valor
      });

      if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      row.getCell(8).numFmt = '"R$ "#,##0.00';
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "LaMore_Extrato_Vendas_Gerais.xlsx");
  }

  function exportarVendasPDF() {
    const doc = new jsPDF("landscape");
    doc.setFontSize(20);
    doc.setTextColor(29, 52, 97);
    doc.text("LA MORE EVENTOS", 14, 18);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Extrato Completo de Vendas Gerais (Tabela)", 14, 25);
    doc.text(`Período: ${dataInicio || "Todo o período"} até ${dataFim || "Hoje"} | Total: ${vendasMestre.length} transações`, 14, 31);

    autoTable(doc, {
      startY: 36,
      head: [["Data", "Hora", "Cliente", "Item / Ação", "Categoria", "Operador", "Tipo", "Valor (R$)"]],
      body: vendasMestre.map(v => [
        v.data,
        v.hora,
        v.cliente,
        v.produto,
        v.categoria,
        v.operador,
        v.pagto,
        `R$ ${v.valor.toFixed(2).replace('.', ',')}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [29, 52, 97], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8 }
    });

    doc.save("LaMore_Extrato_Vendas_Gerais.pdf");
  }

  // 4. Exportação de Produtos (Excel & PDF)
  async function exportarProdutosXLSX() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "La More Eventos";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Relatório de Produtos", { properties: { tabColor: { argb: 'FFF59E0B' } } });

    ws.mergeCells('A1:F2');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'LA MORE EVENTOS - Relatório Detalhado de Vendas por Produto';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.getCell('A3').value = `Período: ${dataInicio || "Todo o período"} até ${dataFim || "Hoje"} | Total de Produtos: ${vendasPorProduto.length}`;
    ws.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF4B5563' } };

    const headerRow = ws.getRow(5);
    headerRow.values = ["Posição", "Produto / Item", "Categoria", "Preço Unitário (R$)", "Transações (Bipadas)", "Unidades Físicas (Qtd Real)", "Faturamento Total (R$)"];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };

    ws.columns = [
      { key: "pos", width: 10 },
      { key: "nome", width: 32 },
      { key: "grupo", width: 20 },
      { key: "preco", width: 22 },
      { key: "bipadas", width: 22 },
      { key: "qtd", width: 26 },
      { key: "valor", width: 22 }
    ];

    vendasPorProduto.forEach((p, idx) => {
      const row = ws.addRow({
        pos: `${idx + 1}º`,
        nome: p.name,
        grupo: p.grupo || 'Geral',
        preco: p.precoUnitario || 0,
        bipadas: p.pedidos || p.qtd,
        qtd: p.qtd,
        valor: p.value
      });

      if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      row.getCell(4).numFmt = '"R$ "#,##0.00';
      row.getCell(7).numFmt = '"R$ "#,##0.00';
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "LaMore_Relatorio_Produtos.xlsx");
  }

  function exportarProdutosPDF() {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(29, 52, 97);
    doc.text("LA MORE EVENTOS", 14, 18);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Relatório Detalhado de Vendas por Produto", 14, 25);
    doc.text(`Período: ${dataInicio || "Todo o período"} até ${dataFim || "Hoje"} | Total: ${vendasPorProduto.length} itens`, 14, 31);

    autoTable(doc, {
      startY: 36,
      head: [["#", "Produto / Item", "Categoria", "Preço Unit.", "Transações", "Qtd Real Vendida", "Total Faturado"]],
      body: vendasPorProduto.map((p, idx) => [
        idx + 1,
        p.name,
        p.grupo || 'Geral',
        `R$ ${(p.precoUnitario || 0).toFixed(2).replace('.', ',')}`,
        p.pedidos || p.qtd,
        `${p.qtd} un`,
        `R$ ${p.value.toFixed(2).replace('.', ',')}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    doc.save("LaMore_Relatorio_Produtos.pdf");
  }

  // 5. Exportação de Recebimentos (Excel & PDF)
  async function exportarRecebimentosXLSX() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "La More Eventos";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Recebimentos", { properties: { tabColor: { argb: 'FF3B82F6' } } });

    ws.mergeCells('A1:D2');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'LA MORE EVENTOS - Relatório de Recebimentos por Forma de Pagamento';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.getCell('A3').value = `Período: ${dataInicio || "Todo o período"} até ${dataFim || "Hoje"}`;
    ws.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF4B5563' } };

    const headerRow = ws.getRow(5);
    headerRow.values = ["Forma de Pagamento", "Qtd Transações", "Faturamento Total (R$)", "% do Total"];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };

    ws.columns = [
      { key: "forma", width: 28 },
      { key: "qtd", width: 18 },
      { key: "valor", width: 24 },
      { key: "perc", width: 16 }
    ];

    recebimentos.forEach((r, idx) => {
      const perc = summary.totalRecarregado > 0 ? (r.value / summary.totalRecarregado) * 100 : 0;
      const row = ws.addRow({
        forma: r.name,
        qtd: r.qtd,
        valor: r.value,
        perc: `${perc.toFixed(1)}%`
      });

      if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      row.getCell(3).numFmt = '"R$ "#,##0.00';
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "LaMore_Relatorio_Recebimentos.xlsx");
  }

  function exportarRecebimentosPDF() {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(29, 52, 97);
    doc.text("LA MORE EVENTOS", 14, 18);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Relatório de Recebimentos por Forma de Pagamento", 14, 25);
    doc.text(`Período: ${dataInicio || "Todo o período"} até ${dataFim || "Hoje"}`, 14, 31);

    autoTable(doc, {
      startY: 36,
      head: [["Forma de Pagamento", "Qtd Transações", "Faturamento Total", "% do Total"]],
      body: recebimentos.map(r => [
        r.name,
        r.qtd,
        `R$ ${r.value.toFixed(2).replace('.', ',')}`,
        `${summary.totalRecarregado > 0 ? ((r.value / summary.totalRecarregado) * 100).toFixed(1) : 0}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    doc.save("LaMore_Relatorio_Recebimentos.pdf");
  }

  // 6. Exportação Geral BI
  async function exportarGeralXLSX() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "La More Eventos";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Balanço Geral BI", { properties: { tabColor: { argb: 'FF10B981' } } });

    ws.mergeCells('A1:D2');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'LA MORE EVENTOS - Relatório Geral de Balanço (BI)';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.getCell('A3').value = `Período: ${dataInicio || "Todo o período"} até ${dataFim || "Hoje"}`;
    ws.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF4B5563' } };

    const headerRow = ws.getRow(5);
    headerRow.values = ["Indicador Financeiro", "Valor (R$)", "Observação"];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

    ws.columns = [
      { key: "indicador", width: 35 },
      { key: "valor", width: 22 },
      { key: "obs", width: 40 }
    ];

    const kpis = [
      { indicador: "Total de Receitas (Recargas)", valor: summary.totalRecarregado, obs: "Total bruto injetado nos cartões de consumo" },
      { indicador: "Total de Débitos (Consumo Bar / Food)", valor: summary.totalDebito, obs: "Total consumido pelos clientes nas barracas" },
      { indicador: "Total de Devoluções (Estornos)", valor: summary.totalEstorno, obs: "Total devolvido em dinheiro/pix no caixa" },
      { indicador: "Saldo em Aberto (Cartões)", valor: summary.saldoEmAberto, obs: "Crédito restante nos cartões emitidos" },
      { indicador: "Total de Cartões Emitidos", valor: summary.totalCartoes, obs: "Quantidade de cartões físicos e digitais" },
      { indicador: "Ticket Médio por Consumo", valor: summary.ticketMedio, obs: "Média de valor gasto por transação" }
    ];

    kpis.forEach((k, idx) => {
      const row = ws.addRow({
        indicador: k.indicador,
        valor: k.valor,
        obs: k.obs
      });
      if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      if (k.indicador !== "Total de Cartões Emitidos") {
        row.getCell(2).numFmt = '"R$ "#,##0.00';
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "LaMore_Balanco_Geral_BI.xlsx");
  }

  function exportarGeralPDF() {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(29, 52, 97);
    doc.text("LA MORE EVENTOS", 14, 18);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Relatório Geral de Balanço (BI)", 14, 25);
    doc.text(`Período: ${dataInicio || "Todo o período"} até ${dataFim || "Hoje"}`, 14, 31);

    autoTable(doc, {
      startY: 36,
      head: [["Indicador Financeiro", "Valor", "Descrição"]],
      body: [
        ["Total de Receitas (Recargas)", `R$ ${summary.totalRecarregado.toFixed(2).replace('.', ',')}`, "Total injetado nos cartões"],
        ["Total de Débitos (Consumo Bar/Food)", `R$ ${summary.totalDebito.toFixed(2).replace('.', ',')}`, "Total consumido nas barracas"],
        ["Total de Devoluções (Estornos)", `R$ ${summary.totalEstorno.toFixed(2).replace('.', ',')}`, "Total devolvido no caixa"],
        ["Saldo em Aberto (Cartões)", `R$ ${summary.saldoEmAberto.toFixed(2).replace('.', ',')}`, "Crédito remanescente"],
        ["Total de Cartões Emitidos", `${summary.totalCartoes} cartões`, "Físicos e Digitais"]
      ],
      theme: 'grid',
      headStyles: { fillColor: [29, 52, 97], textColor: [255, 255, 255] }
    });

    doc.save("LaMore_Balanco_Geral_BI.pdf");
  }

  const handleExportarPDF = () => {
    if (aba === "cortesias") return exportarCortesiasPDF();
    if (aba === "vendas") return exportarVendasPDF();
    if (aba === "produtos") return exportarProdutosPDF();
    if (aba === "recebimentos") return exportarRecebimentosPDF();
    return exportarGeralPDF();
  };

  const handleExportarXLSX = () => {
    if (aba === "cortesias") return exportarCortesiasXLSX();
    if (aba === "vendas") return exportarVendasXLSX();
    if (aba === "produtos") return exportarProdutosXLSX();
    if (aba === "recebimentos") return exportarRecebimentosXLSX();
    return exportarGeralXLSX();
  };

  const getNomeAbaAtual = () => {
    switch (aba) {
      case "bi": return { titulo: "Visão Geral de BI", desc: "Painel de indicadores gerenciais e balanço financeiro" };
      case "vendas": return { titulo: "Vendas Gerais de Tabela", desc: "Extrato cronológico detalhado de todas as transações" };
      case "produtos": return { titulo: "Relatório de Produtos", desc: "Ranking detalhado de vendas com unidades físicas e faturamento" };
      case "recebimentos": return { titulo: "Relatório de Recebimentos", desc: "Distribuição das recargas por forma de pagamento" };
      case "cortesias": return { titulo: "Cortesias por Pessoa", desc: "Consolidação de cortesias, recargas e consumo individual" };
      default: return { titulo: "Relatórios e BI", desc: "Dados consolidados do evento" };
    }
  };

  const infoAba = getNomeAbaAtual();

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Header e Filtros */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
        <div>
          <h2 className="text-4xl font-black text-[#1D3461]">{infoAba.titulo}</h2>
          <p className="text-gray-500 text-lg font-semibold mt-1">{infoAba.desc}</p>
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
              <span>📊</span> {
                aba === 'cortesias' ? 'Excel (Cortesias)' :
                aba === 'vendas' ? 'Excel (Vendas Gerais)' :
                aba === 'produtos' ? 'Excel (Produtos)' :
                aba === 'recebimentos' ? 'Excel (Recebimentos)' :
                'Excel (BI Geral)'
              }
            </button>
            <button onClick={handleExportarPDF} className="bg-red-600 text-white font-black text-sm px-5 py-3 rounded-xl hover:bg-red-700 transition-all flex items-center gap-2 shadow-sm cursor-pointer">
              <span>📄</span> {
                aba === 'cortesias' ? 'PDF (Cortesias)' :
                aba === 'vendas' ? 'PDF (Vendas Gerais)' :
                aba === 'produtos' ? 'PDF (Produtos)' :
                aba === 'recebimentos' ? 'PDF (Recebimentos)' :
                'PDF (BI Geral)'
              }
            </button>
          </div>
        </div>
      </div>

      {/* Navegação de Abas */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: "bi", label: "📈 Visão Geral de BI" },
          { id: "vendas", label: "🧾 Vendas Gerais de Tabela" },
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
                R$ {Math.max(0, (summary.totalCortesiasValor || 0) - (summary.totalCortesiasConsumido || 0) - (summary.totalCortesiasDevolvido || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-amber-600 font-bold text-sm mt-1">
                Saldo Restante {summary.totalCortesiasDevolvido > 0 && `(Devolvido: R$ ${summary.totalCortesiasDevolvido.toFixed(2).replace('.', ',')})`}
              </p>
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

          {/* Lista de Cortesias Consolidadas por Pessoa */}
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
                          Operador Principal: <b>{pessoa.operadorPrincipal}</b> {pessoa.clienteCpf && `• CPF: ${pessoa.clienteCpf}`} {pessoa.clienteCelular && `• Tel: ${pessoa.clienteCelular}`}
                        </p>
                      </div>
                    </div>

                    {/* Resumo Financeiro da Pessoa */}
                    <div className="flex flex-wrap items-center gap-3 bg-black/20 p-3 rounded-2xl border border-white/10">
                      <div className="text-center px-3">
                        <p className="text-[10px] uppercase font-bold text-purple-200">Cortesia</p>
                        <p className="text-lg font-black text-purple-300">R$ {pessoa.totalCortesiaConcedida.toFixed(2).replace('.', ',')}</p>
                      </div>
                      {pessoa.totalRecargasPagas > 0 && (
                        <>
                          <div className="w-px h-8 bg-white/20"></div>
                          <div className="text-center px-3">
                            <p className="text-[10px] uppercase font-bold text-blue-200">+ Recarga Paga</p>
                            <p className="text-lg font-black text-blue-300">R$ {pessoa.totalRecargasPagas.toFixed(2).replace('.', ',')}</p>
                          </div>
                        </>
                      )}
                      <div className="w-px h-8 bg-white/20"></div>
                      <div className="text-center px-3">
                        <p className="text-[10px] uppercase font-bold text-emerald-200">Consumido</p>
                        <p className="text-lg font-black text-emerald-400">R$ {pessoa.totalConsumido.toFixed(2).replace('.', ',')}</p>
                      </div>
                      {pessoa.totalDevolvido > 0 && (
                        <>
                          <div className="w-px h-8 bg-white/20"></div>
                          <div className="text-center px-3">
                            <p className="text-[10px] uppercase font-bold text-red-200">Devolvido</p>
                            <p className="text-lg font-black text-red-400">R$ {pessoa.totalDevolvido.toFixed(2).replace('.', ',')}</p>
                          </div>
                        </>
                      )}
                      <div className="w-px h-8 bg-white/20"></div>
                      <div className="text-center px-3">
                        <p className="text-[10px] uppercase font-bold text-amber-200">Saldo Restante</p>
                        <p className="text-lg font-black text-amber-300">R$ {pessoa.saldoRestante.toFixed(2).replace('.', ',')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Extrato de Itens Consumidos pela Pessoa */}
                  <div className="p-6 space-y-4">
                    {/* Histórico de Recargas do Cartão */}
                    {pessoa.recargas && pessoa.recargas.length > 0 && (
                      <div>
                        <h4 className="text-sm font-black text-purple-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <span>💳</span> Recargas Efetuadas no Cartão ({pessoa.recargas.length})
                        </h4>
                        <div className="overflow-x-auto rounded-2xl border border-purple-100 bg-purple-50/20">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-purple-50/60 text-purple-900 text-xs uppercase font-black">
                                <th className="p-3">Data / Hora</th>
                                <th className="p-3">Tipo de Recarga</th>
                                <th className="p-3">Operador / Caixa</th>
                                <th className="p-3 text-right">Valor Creditado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-purple-100">
                              {pessoa.recargas.map((r) => (
                                <tr key={r.id}>
                                  <td className="p-3 text-xs font-bold text-gray-600">{r.data} {r.hora}</td>
                                  <td className="p-3 text-sm font-bold text-purple-900">
                                    <span className={`px-2 py-0.5 rounded-md text-xs font-black ${r.tipoRecarga === 'Cortesia' ? 'bg-purple-200 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                      {r.tipoRecarga}
                                    </span>
                                  </td>
                                  <td className="p-3 text-xs font-semibold text-gray-600">{r.operador}</td>
                                  <td className="p-3 text-sm font-black text-purple-900 text-right">R$ {r.valor.toFixed(2).replace('.', ',')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Consumo de Produtos */}
                    <div>
                      <h4 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span>🍔</span> Extrato de Consumo ({pessoa.consumos.length} {pessoa.consumos.length === 1 ? 'item' : 'itens'})
                      </h4>

                      {pessoa.consumos.length === 0 ? (
                        <div className="p-6 bg-gray-50 rounded-2xl text-center border-2 border-dashed border-gray-200">
                          <p className="text-gray-400 font-bold text-sm">Esta pessoa não realizou nenhum consumo nos bares ou barracas com este cartão.</p>
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

                    {/* Devoluções / Estornos de Saldo */}
                    {pessoa.devolucoes && pessoa.devolucoes.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-sm font-black text-red-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <span>🔄</span> Estornos / Devoluções de Saldo Realizadas ({pessoa.devolucoes.length})
                        </h4>
                        <div className="overflow-x-auto rounded-2xl border border-red-100 bg-red-50/30">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-red-50 text-red-700 text-xs uppercase font-black">
                                <th className="p-3">Data / Hora</th>
                                <th className="p-3">Operação</th>
                                <th className="p-3">Responsável</th>
                                <th className="p-3 text-right">Valor Estornado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-red-100">
                              {pessoa.devolucoes.map((d) => (
                                <tr key={d.id}>
                                  <td className="p-3 text-xs font-bold text-gray-600">{d.data} {d.hora}</td>
                                  <td className="p-3 text-sm font-bold text-red-700">{d.descricao || 'Devolução de Saldo'}</td>
                                  <td className="p-3 text-xs font-semibold text-gray-600">{d.operador}</td>
                                  <td className="p-3 text-sm font-black text-red-700 text-right">R$ {d.valor.toFixed(2).replace('.', ',')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
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
            <div>
              <h3 className="text-2xl font-black">Ranking de Vendas por Produto</h3>
              <p className="text-blue-200 text-sm font-semibold mt-0.5">Contagem exata de unidades físicas e transações</p>
            </div>
            <span className="bg-white/20 text-white font-bold px-3 py-1 rounded-xl text-sm">{vendasPorProduto.length} itens</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-100">
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs">Produto / Item</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs text-center">Preço Unit.</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs text-center">Transações (Bipadas)</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs text-center">Unidades Físicas (Qtd Real)</th>
                  <th className="p-4 font-bold text-gray-400 uppercase text-xs text-right">Faturamento Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendasPorProduto.map((p, idx) => (
                  <tr key={p.name} className="hover:bg-blue-50/50 transition-colors">
                    <td className="p-4 font-black text-gray-900">
                      {idx + 1}. {p.name}
                      {p.grupo && <span className="ml-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-500">{p.grupo}</span>}
                    </td>
                    <td className="p-4 font-bold text-gray-600 text-center">
                      R$ {(p.precoUnitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 font-bold text-gray-500 text-center">{p.pedidos || p.qtd}</td>
                    <td className="p-4 font-black text-[#1D3461] text-center text-lg bg-blue-50/30">
                      {p.qtd} <span className="text-xs font-semibold text-gray-500">un</span>
                    </td>
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
