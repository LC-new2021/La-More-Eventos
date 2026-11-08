"use client";
import { useEffect, useState } from 'react';
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function formatarDescricaoLog(log) {
  if (log.tipo === 'HISTORICO_PRECO') {
    try {
      const p = JSON.parse(log.descricao || '{}');
      return `Alterou preço do produto "${log.produto?.nome || 'Produto'}": De R$ ${Number(p.de || 0).toFixed(2).replace('.', ',')} para R$ ${Number(p.para || log.valor || 0).toFixed(2).replace('.', ',')}`;
    } catch {
      return log.descricao || 'Alteração de preço de produto';
    }
  }
  if (log.tipo === 'AUDITORIA_SUPORTE') {
    return log.descricao || 'Ação de Suporte Operacional';
  }
  return log.produto?.nome ? `${log.descricao || log.produto.nome}` : (log.descricao || log.tipo);
}

export default function MasterAuditoria() {
  const [logs, setLogs] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [abaTipo, setAbaTipo] = useState('todos'); // todos | suporte | precos | financeiro
  const [eventoId, setEventoId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    carregarEventos();
  }, []);

  useEffect(() => {
    if (eventos.length > 0 && !eventoId) {
      const stored = localStorage.getItem("activeEventoId");
      if (stored && eventos.find(e => e.id === stored)) {
        setEventoId(stored);
      }
    }
  }, [eventos]);

  useEffect(() => {
    carregarAuditoria();
  }, [eventoId, dataInicio, dataFim]);

  const carregarEventos = async () => {
    try {
      const res = await fetch("/api/eventos");
      const data = await res.json();
      if (!data.error && Array.isArray(data)) {
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
      else setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Erro ao buscar auditoria');
    } finally {
      setLoading(false);
    }
  };

  const isLogSuporte = (log) => {
    const opRole = log.operador?.role;
    return (
      log.tipo === 'AUDITORIA_SUPORTE' ||
      opRole === 'SUPORTE_OPERACIONAL' ||
      opRole === 'CLIENTE' ||
      opRole === 'SUPORTE'
    );
  };

  const totalSuporte = logs.filter(isLogSuporte).length;
  const totalPrecos = logs.filter(l => l.tipo === 'HISTORICO_PRECO').length;
  const totalFinanceiro = logs.filter(l => ['RECARGA', 'DEBITO', 'ESTORNO'].includes(l.tipo)).length;

  const logsFiltrados = logs
    .filter(log => {
      if (abaTipo === 'suporte') return isLogSuporte(log);
      if (abaTipo === 'precos') return log.tipo === 'HISTORICO_PRECO';
      if (abaTipo === 'financeiro') return ['RECARGA', 'DEBITO', 'ESTORNO'].includes(log.tipo);
      return true;
    })
    .filter(log => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      const clienteNome = log.cartao?.cliente?.nome?.toLowerCase() || '';
      const clienteCpf = log.cartao?.cliente?.cpf?.toLowerCase() || '';
      const clienteCelular = log.cartao?.cliente?.celular?.toLowerCase() || '';
      const cartaoCodigo = log.cartao?.codigo?.toLowerCase() || '';
      const operadorNome = log.operador?.nome?.toLowerCase() || log.operadorNome?.toLowerCase() || '';
      const produtoNome = log.produto?.nome?.toLowerCase() || '';
      const descricao = formatarDescricaoLog(log).toLowerCase();
      const tipo = log.tipo?.toLowerCase() || '';

      return (
        clienteNome.includes(q) ||
        clienteCpf.includes(q) ||
        clienteCelular.includes(q) ||
        cartaoCodigo.includes(q) ||
        operadorNome.includes(q) ||
        produtoNome.includes(q) ||
        descricao.includes(q) ||
        tipo.includes(q)
      );
    });

  const exportarXLSX = async () => {
    if (!logsFiltrados || logsFiltrados.length === 0) return;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "La More Eventos";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Auditoria Completa", { properties: { tabColor: { argb: 'FF1D3461' } } });

    worksheet.mergeCells('A1:N2');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LA MORE EVENTOS - Relatório de Auditoria e Rastreio de Movimentações (Exclusivo Master)';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3461' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.getCell('A3').value = `Filtros: ${dataInicio || "Início"} a ${dataFim || "Fim"} | Aba: ${abaTipo.toUpperCase()} | Total de Registros: ${logsFiltrados.length}`;
    worksheet.getCell('A3').font = { italic: true };

    const headerRow = worksheet.getRow(5);
    headerRow.values = [
      "Data",
      "Hora",
      "Evento",
      "Tipo",
      "Item / Ação / Descrição",
      "Categoria",
      "Cliente (Nome)",
      "CPF",
      "Celular / Telefone",
      "Código Cartão",
      "Operador / Responsável",
      "Cargo Operador",
      "Valor (R$)",
      "Saldo Atual do Cartão (R$)"
    ];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };

    worksheet.columns = [
      { key: "data", width: 14 },
      { key: "hora", width: 10 },
      { key: "evento", width: 25 },
      { key: "tipo", width: 20 },
      { key: "detalhes", width: 42 },
      { key: "categoria", width: 18 },
      { key: "cliente", width: 25 },
      { key: "cpf", width: 18 },
      { key: "celular", width: 18 },
      { key: "cartao", width: 15 },
      { key: "operador", width: 24 },
      { key: "cargo", width: 20 },
      { key: "valor", width: 16, style: { numFmt: '"R$" #,##0.00' } },
      { key: "saldo", width: 18, style: { numFmt: '"R$" #,##0.00' } }
    ];

    logsFiltrados.forEach((log) => {
      const dataObj = new Date(log.criadaEm);
      const dataStr = dataObj.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const horaStr = dataObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

      worksheet.addRow({
        data: dataStr,
        hora: horaStr,
        evento: log.eventoNome || "Evento",
        tipo: log.tipo === 'AUDITORIA_SUPORTE' ? 'RASTREIO SUPORTE' : log.tipo === 'HISTORICO_PRECO' ? 'ALTERAÇÃO DE PREÇO' : log.tipo,
        detalhes: formatarDescricaoLog(log),
        categoria: log.produto?.grupo || "—",
        cliente: log.cartao?.cliente?.nome || "—",
        cpf: log.cartao?.cliente?.cpf || "—",
        celular: log.cartao?.cliente?.celular || "—",
        cartao: log.cartao?.codigo || "—",
        operador: log.operador?.nome || log.operadorNome || "Sistema",
        cargo: log.operador?.role || (log.tipo === 'AUDITORIA_SUPORTE' ? 'SUPORTE_OPERACIONAL' : 'Sistema'),
        valor: Number(log.valor || 0),
        saldo: Number(log.cartao?.saldo || 0)
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Auditoria_LaMore_${Date.now()}.xlsx`);
  };

  const exportarPDF = () => {
    if (!logsFiltrados || logsFiltrados.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    
    doc.setFillColor(29, 52, 97);
    doc.rect(0, 0, 297, 20, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("LA MORE EVENTOS - RELATÓRIO DE AUDITORIA & RASTREIO", 14, 13);

    const rows = logsFiltrados.map((log) => {
      const dataObj = new Date(log.criadaEm);
      const dataFormatada = `${dataObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} ${dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`;
      return [
        dataFormatada,
        log.tipo === 'AUDITORIA_SUPORTE' ? 'SUPORTE OP.' : log.tipo === 'HISTORICO_PRECO' ? 'ALT. PREÇO' : log.tipo,
        formatarDescricaoLog(log),
        log.cartao?.cliente?.nome || '—',
        log.cartao?.codigo || '—',
        log.operador?.nome || log.operadorNome || 'Sistema',
        `R$ ${Number(log.valor || 0).toFixed(2).replace('.', ',')}`
      ];
    });

    autoTable(doc, {
      startY: 25,
      head: [["Data/Hora", "Tipo", "Ação / Detalhes", "Cliente", "Cartão", "Operador", "Valor"]],
      body: rows,
      theme: "striped",
      headStyles: { fillColor: [29, 52, 97], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2 },
    });

    doc.save(`Auditoria_LaMore_${Date.now()}.pdf`);
  };

  return (
    <div className="w-full mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1D3461]">Auditoria & Rastreio</h2>
          <p className="text-gray-500 text-xs sm:text-sm font-semibold">
            Rastreio completo de suporte operacional, reajustes de preços e movimentações financeiras
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportarXLSX}
            className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>📊</span> Exportar XLSX
          </button>
          <button
            onClick={exportarPDF}
            className="bg-[#1D3461] hover:bg-[#112244] text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>📄</span> PDF
          </button>
        </div>
      </div>

      {/* Abas de Rastreio */}
      <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm mb-4">
        <button
          onClick={() => setAbaTipo('todos')}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
            abaTipo === 'todos' ? 'bg-[#1D3461] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>📋 Todas</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${abaTipo === 'todos' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {logs.length}
          </span>
        </button>

        <button
          onClick={() => setAbaTipo('suporte')}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
            abaTipo === 'suporte' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>🛠️ Suporte Operacional</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${abaTipo === 'suporte' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'}`}>
            {totalSuporte}
          </span>
        </button>

        <button
          onClick={() => setAbaTipo('precos')}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
            abaTipo === 'precos' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>💲 Alterações de Preços</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${abaTipo === 'precos' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
            {totalPrecos}
          </span>
        </button>

        <button
          onClick={() => setAbaTipo('financeiro')}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
            abaTipo === 'financeiro' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>💳 Financeiro</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${abaTipo === 'financeiro' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'}`}>
            {totalFinanceiro}
          </span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm mb-4 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Filtrar por Evento</label>
            <select
              value={eventoId}
              onChange={(e) => {
                setEventoId(e.target.value);
                localStorage.setItem("activeEventoId", e.target.value);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 font-bold text-xs text-[#1D3461] outline-none cursor-pointer"
            >
              <option value="">Todos os Eventos</option>
              {eventos.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Data Inicial</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 font-semibold text-xs text-gray-900 outline-none"/>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Data Final</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 font-semibold text-xs text-gray-900 outline-none"/>
          </div>
        </div>

        {/* Busca Rápida em Tempo Real */}
        <div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔍 Buscar por nome do cliente, CPF, código do cartão, produto, operador ou ação..."
            className="w-full bg-gray-50 border border-gray-200 focus:border-[#1D3461] rounded-lg px-3 py-1.5 font-semibold text-xs text-gray-900 outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-3 rounded-xl mb-4 font-bold text-xs">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">
          <p className="text-[#1D3461] text-base font-bold">Carregando movimentações...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-2.5 bg-gray-50/80 border-b border-gray-200 flex justify-between items-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            <span>Listando {logsFiltrados.length} de {logs.length} movimentações</span>
          </div>
          <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-gray-500 font-bold text-[11px] uppercase tracking-wider z-10">
                <tr>
                  <th className="py-2.5 px-3 w-[15%]">Data & Hora</th>
                  <th className="py-2.5 px-3 w-[13%]">Tipo</th>
                  <th className="py-2.5 px-3 w-[30%]">Detalhes / Ação</th>
                  <th className="py-2.5 px-3 w-[18%]">Cliente / Cartão</th>
                  <th className="py-2.5 px-3 w-[14%]">Operador</th>
                  <th className="py-2.5 px-3 w-[10%] text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {logsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 font-bold">Nenhum registro encontrado.</td>
                  </tr>
                ) : (
                  logsFiltrados.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                        <span className="font-semibold">{new Date(log.criadaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>{' '}
                        <span className="font-bold text-gray-900">{new Date(log.criadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap inline-block ${
                          log.tipo === 'RECARGA' ? 'bg-green-100 text-green-800' :
                          log.tipo === 'DEBITO' ? 'bg-blue-100 text-blue-800' :
                          log.tipo === 'AUDITORIA_SUPORTE' ? 'bg-teal-100 text-teal-800 border border-teal-300' :
                          log.tipo === 'HISTORICO_PRECO' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {log.tipo === 'AUDITORIA_SUPORTE' ? '🛠️ SUPORTE OP.' : log.tipo === 'HISTORICO_PRECO' ? '💲 ALT. PREÇO' : log.tipo}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <p className="font-bold text-gray-900 truncate" title={formatarDescricaoLog(log)}>
                          {formatarDescricaoLog(log)}
                        </p>
                        {log.eventoNome && (
                          <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-semibold inline-block mt-0.5 truncate max-w-full">
                            🎪 {log.eventoNome}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <p className="font-bold text-gray-900 truncate" title={log.cartao?.cliente?.nome || '—'}>
                          {log.cartao?.cliente?.nome || '—'}
                        </p>
                        {log.cartao?.codigo && (
                          <p className="text-purple-700 font-mono font-bold text-[10px]">Cód: {log.cartao.codigo}</p>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <p className="font-bold text-gray-800 truncate" title={log.operador?.nome || log.operadorNome || 'Sistema'}>
                          {log.operador?.nome || log.operadorNome || 'Sistema'}
                        </p>
                        <p className="text-gray-400 text-[10px] uppercase font-semibold">
                          {log.operador?.role?.replace('_', ' ') || (log.tipo === 'AUDITORIA_SUPORTE' ? 'SUPORTE' : 'Online')}
                        </p>
                      </td>
                      <td className={`py-2 px-3 font-bold text-right whitespace-nowrap ${
                        log.tipo === 'RECARGA' ? 'text-green-600' :
                        log.tipo === 'DEBITO' ? 'text-gray-900' :
                        log.tipo === 'AUDITORIA_SUPORTE' || log.tipo === 'HISTORICO_PRECO' ? 'text-amber-700' :
                        'text-red-600'
                      }`}>
                        {log.tipo === 'AUDITORIA_SUPORTE' && Number(log.valor || 0) === 0
                          ? '—'
                          : `${log.tipo === 'RECARGA' ? '+' : log.tipo === 'DEBITO' || log.tipo === 'ESTORNO' ? '-' : ''} R$ ${Number(log.valor || 0).toFixed(2).replace('.', ',')}`}
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
