"use client";
import { useEffect, useState } from 'react';
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function MasterFinanceiro() {
  const [financeiro, setFinanceiro] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtros
  const [eventoId, setEventoId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    carregarEventos();
  }, []);

  useEffect(() => {
    carregarDadosFinanceiros();
  }, [eventoId, dataInicio, dataFim]);

  const carregarEventos = async () => {
    try {
      const res = await fetch("/api/eventos");
      const data = await res.json();
      if (!data.error) {
        setEventos(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const carregarDadosFinanceiros = async () => {
    setLoading(true);
    try {
      let url = '/api/master/financeiro?';
      if (eventoId) url += `eventoId=${eventoId}&`;
      if (dataInicio) url += `dataInicio=${dataInicio}&`;
      if (dataFim) url += `dataFim=${dataFim}&`;

      const r = await fetch(url);
      const data = await r.json();
      
      if (data.error) setError(data.error);
      else setFinanceiro(data);
    } catch (e) {
      setError('Erro ao buscar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  const exportarXLSX = async () => {
    if (!financeiro) return;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Financeiro");
    
    worksheet.columns = [
      { header: "Evento", key: "evento", width: 30 },
      { header: "Taxa La More (%)", key: "taxa", width: 20 },
      { header: "Volume Processado (R$)", key: "volume", width: 25 },
      { header: "Royalty (R$)", key: "royalty", width: 20 },
      { header: "Status", key: "status", width: 15 },
    ];
    
    financeiro.eventos.forEach(ev => {
      worksheet.addRow({
        evento: ev.nome,
        taxa: `${ev.taxaMasterPercent}%`,
        volume: ev.totalRecarregado.toFixed(2).replace('.', ','),
        royalty: ev.totalTaxaMaster.toFixed(2).replace('.', ','),
        status: ev.status
      });
    });

    // Add totals row
    worksheet.addRow([]);
    worksheet.addRow({
      evento: "TOTAIS",
      volume: financeiro.totalRecarregadoGlobal.toFixed(2).replace('.', ','),
      royalty: financeiro.totalTaxaMasterGlobal.toFixed(2).replace('.', ',')
    });
    
    worksheet.getRow(worksheet.rowCount).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "Relatorio_Financeiro.xlsx");
  };

  const exportarPDF = () => {
    if (!financeiro) return;
    const doc = new jsPDF("landscape");
    doc.text("Relatório Financeiro e Royalties", 14, 15);
    
    const tableData = financeiro.eventos.map(ev => [
      ev.nome,
      `${ev.taxaMasterPercent}%`,
      `R$ ${ev.totalRecarregado.toFixed(2).replace('.', ',')}`,
      `R$ ${ev.totalTaxaMaster.toFixed(2).replace('.', ',')}`,
      ev.status
    ]);

    tableData.push([
      "TOTAIS",
      "",
      `R$ ${financeiro.totalRecarregadoGlobal.toFixed(2).replace('.', ',')}`,
      `R$ ${financeiro.totalTaxaMasterGlobal.toFixed(2).replace('.', ',')}`,
      ""
    ]);

    autoTable(doc, {
      head: [["Evento", "Taxa (%)", "Volume Processado", "Royalty", "Status"]],
      body: tableData,
      startY: 20,
      didParseCell: function(data) {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
    doc.save("Relatorio_Financeiro.pdf");
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-black text-[#1D3461] mb-2">Financeiro & Royalties</h2>
          <p className="text-gray-500 text-lg font-semibold">Controle de taxas e faturamento global da plataforma</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportarXLSX}
            className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2"
          >
            <span>📊</span> Excel
          </button>
          <button
            onClick={exportarPDF}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2"
          >
            <span>📄</span> PDF
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm mb-8 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-bold text-gray-500 mb-1">Filtrar por Evento</label>
          <select
            value={eventoId}
            onChange={(e) => setEventoId(e.target.value)}
            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 font-bold text-[#1D3461] outline-none"
          >
            <option value="">Todos os Eventos</option>
            {eventos.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-bold text-gray-500 mb-1">Data Inicial</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 font-bold text-gray-700 outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-bold text-gray-500 mb-1">Data Final</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 font-bold text-gray-700 outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold">
          ⚠️ {error}
        </div>
      )}

      {loading || !financeiro ? (
        <div className="text-center py-12">
          <p className="text-[#1D3461] text-xl font-bold">Carregando dados financeiros...</p>
        </div>
      ) : (
        <>
          {/* Resumo Global */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 flex items-center gap-4">
              <span className="text-5xl">💰</span>
              <div>
                <p className="text-gray-400 text-sm font-bold uppercase">Volume Total Processado</p>
                <p className="font-black text-3xl text-gray-900">
                  R$ {financeiro.totalRecarregadoGlobal.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>

            <div className="bg-purple-50 rounded-3xl p-6 border-2 border-purple-100 flex items-center gap-4">
              <span className="text-5xl">👑</span>
              <div>
                <p className="text-purple-600 text-sm font-bold uppercase">Total Taxa La More (Royalties)</p>
                <p className="font-black text-3xl text-purple-900">
                  R$ {financeiro.totalTaxaMasterGlobal.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
          </div>

          {/* Faturamento por Evento */}
          <h3 className="text-2xl font-black text-[#1D3461] mb-4">Faturamento por Evento</h3>
          <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-100 text-gray-500 font-bold">
                    <th className="p-6">Evento</th>
                    <th className="p-6">Taxa (%)</th>
                    <th className="p-6">Volume Total</th>
                    <th className="p-6">Royalty (La More)</th>
                    <th className="p-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                  {financeiro.eventos.map((evt) => (
                    <tr key={evt.id} className="hover:bg-gray-50/50">
                      <td className="p-6 font-bold text-gray-900">{evt.nome}</td>
                      <td className="p-6">{evt.taxaMasterPercent}%</td>
                      <td className="p-6">R$ {evt.totalRecarregado.toFixed(2).replace('.', ',')}</td>
                      <td className="p-6 text-purple-700 font-bold">
                        R$ {evt.totalTaxaMaster.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="p-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          evt.status === 'ATIVO' ? 'bg-green-100 text-green-700' :
                          evt.status === 'CONFIGURANDO' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {evt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {financeiro.eventos.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-gray-400">Nenhum dado encontrado para os filtros selecionados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
