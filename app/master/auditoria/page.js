"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function MasterAuditoria() {
  const [logs, setLogs] = useState([]);
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
    carregarAuditoria();
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

  const carregarAuditoria = async () => {
    setLoading(true);
    try {
      let url = '/api/master/auditoria?';
      if (eventoId) url += `eventoId=${eventoId}&`;
      if (dataInicio) url += `dataInicio=${dataInicio}&`;
      if (dataFim) url += `dataFim=${dataFim}&`;

      const r = await fetch(url);
      const data = await r.json();
      
      if (data.error) setError(data.error);
      else setLogs(data);
    } catch (e) {
      setError('Erro ao buscar auditoria');
    } finally {
      setLoading(false);
    }
  };

  const exportarXLSX = async () => {
    if (!logs || logs.length === 0) return;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Auditoria");

    worksheet.mergeCells('A1:F2');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LA MORE EVENTOS - Relatório de Auditoria';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.getCell('A3').value = `Filtros: ${dataInicio || "Início"} a ${dataFim || "Fim"}`;
    worksheet.getCell('A3').font = { italic: true };
    
    const headerRow = worksheet.getRow(5);
    headerRow.values = ["Data/Hora", "Evento", "Tipo", "Cliente / Cartão", "Operador", "Valor (R$)"];
    headerRow.font = { bold: true };

    worksheet.columns = [
      { key: "data", width: 25 },
      { key: "evento", width: 30 },
      { key: "tipo", width: 15 },
      { key: "cliente", width: 30 },
      { key: "operador", width: 20 },
      { key: "valor", width: 15 },
    ];
    
    logs.forEach((log) => {
      worksheet.addRow({
        data: new Date(log.criadaEm).toLocaleString('pt-BR'),
        evento: log.cartao?.evento?.nome || 'Sem Evento',
        tipo: log.tipo,
        cliente: `${log.cartao?.cliente?.nome || '—'} (Cód: ${log.cartao?.codigo})`,
        operador: log.operador?.nome || 'Sistema',
        valor: log.valor
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "LaMore_Auditoria.xlsx");
  };

  const exportarPDF = () => {
    if (!logs || logs.length === 0) return;
    const doc = new jsPDF("landscape");
    doc.setFontSize(22);
    doc.setTextColor(29, 52, 97);
    doc.text("LA MORE EVENTOS", 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text("Relatório de Auditoria", 14, 28);
    doc.setFontSize(11);
    doc.text(`Filtro: ${dataInicio || "Início"} até ${dataFim || "Fim"}`, 14, 34);

    autoTable(doc, {
      startY: 40,
      head: [["Data/Hora", "Evento", "Tipo", "Cliente / Cód", "Operador", "Valor (R$)"]],
      body: logs.map(log => [
        new Date(log.criadaEm).toLocaleString('pt-BR'),
        log.cartao?.evento?.nome || 'Sem Evento',
        log.tipo,
        `${log.cartao?.cliente?.nome || '—'} (${log.cartao?.codigo})`,
        log.operador?.nome || 'Sistema',
        log.valor.toFixed(2).replace('.', ',')
      ]),
      theme: 'grid',
      headStyles: { fillColor: [29, 52, 97], textColor: [255, 255, 255] }
    });

    doc.save("LaMore_Auditoria.pdf");
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-4xl font-black text-[#1D3461] mb-2">Auditoria do Sistema</h2>
          <p className="text-gray-500 text-lg font-semibold">Log em tempo real de todas as movimentações e ações de caixas e bars</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={exportarXLSX} className="bg-green-600 text-white font-black text-sm px-4 py-2 rounded-xl hover:bg-green-700 transition-all flex items-center gap-2">
            <span>📊</span> Excel
          </button>
          <button onClick={exportarPDF} className="bg-red-600 text-white font-black text-sm px-4 py-2 rounded-xl hover:bg-red-700 transition-all flex items-center gap-2">
            <span>📄</span> PDF
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm mb-8 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Filtrar por Evento</label>
          <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-900 outline-none focus:border-[#1D3461]">
            <option value="">Todos os Eventos</option>
            {eventos.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Data Inicial</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-900 outline-none focus:border-[#1D3461]"/>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Data Final</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-900 outline-none focus:border-[#1D3461]"/>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-[#1D3461] text-xl font-bold">Carregando auditoria...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-100 text-gray-500 font-bold">
                  <th className="p-6">Data/Hora</th>
                  <th className="p-6">Evento</th>
                  <th className="p-6">Tipo</th>
                  <th className="p-6">Cliente / Cartão</th>
                  <th className="p-6">Operador</th>
                  <th className="p-6">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 font-bold">Nenhum registro encontrado.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="p-6 text-sm text-gray-500">
                        {new Date(log.criadaEm).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-6 text-sm text-gray-900 font-bold">
                        {log.cartao?.evento?.nome || 'Sem Evento'}
                      </td>
                      <td className="p-6">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          log.tipo === 'RECARGA' ? 'bg-green-100 text-green-700' :
                          log.tipo === 'DEBITO' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {log.tipo}
                        </span>
                      </td>
                      <td className="p-6 text-sm">
                        <p className="font-bold text-gray-950">{log.cartao?.cliente?.nome || '—'}</p>
                        <p className="text-gray-400 font-bold text-xs uppercase">Cód: {log.cartao?.codigo}</p>
                      </td>
                      <td className="p-6 text-sm">
                        <p className="font-bold">{log.operador?.nome || 'Sistema'}</p>
                        <p className="text-gray-400 text-xs font-black uppercase">{log.operador?.role?.replace('_', ' ')}</p>
                      </td>
                      <td className={`p-6 font-black text-lg ${
                        log.tipo === 'RECARGA' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {log.tipo === 'RECARGA' ? '+' : '-'} R$ {log.valor.toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
