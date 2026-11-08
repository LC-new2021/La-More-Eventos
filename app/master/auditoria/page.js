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
      { key: "valor", width: 16 },
      { key: "saldo", width: 18 },
    ];

    logsFiltrados.forEach((log, idx) => {
      const dataObj = new Date(log.criadaEm);
      const dataFormatada = dataObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

      const descricaoCompleta = formatarDescricaoLog(log);
      const categoria = log.produto?.grupo || (log.tipo === 'RECARGA' ? 'Entrada' : log.tipo === 'AUDITORIA_SUPORTE' ? 'Suporte Operacional' : log.tipo);

      const row = worksheet.addRow({
        data: dataFormatada,
        hora: horaFormatada,
        evento: log.eventoNome || log.cartao?.evento?.nome || 'Geral',
        tipo: log.tipo === 'AUDITORIA_SUPORTE' ? 'RASTREIO SUPORTE' : log.tipo === 'HISTORICO_PRECO' ? 'ALT. PREÇO' : log.tipo,
        detalhes: descricaoCompleta,
        categoria: categoria,
        cliente: log.cartao?.cliente?.nome || '—',
        cpf: log.cartao?.cliente?.cpf || '—',
        celular: log.cartao?.cliente?.celular || '—',
        cartao: log.cartao?.codigo || '—',
        operador: log.operador?.nome || log.operadorNome || 'Sistema / Online',
        cargo: log.operador?.role?.replace('_', ' ') || (log.tipo === 'AUDITORIA_SUPORTE' ? 'SUPORTE OPERACIONAL' : 'Online'),
        valor: log.valor,
        saldo: log.cartao?.saldo || 0
      });

      if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      row.getCell(13).numFmt = '"R$ "#,##0.00';
      row.getCell(14).numFmt = '"R$ "#,##0.00';
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `LaMore_Auditoria_${abaTipo}_${eventoId || 'Geral'}.xlsx`);
  };

  const exportarPDF = () => {
    if (!logsFiltrados || logsFiltrados.length === 0) return;
    const doc = new jsPDF("landscape");
    doc.setFontSize(20);
    doc.setTextColor(29, 52, 97);
    doc.text("LA MORE EVENTOS", 14, 18);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Relatório de Auditoria e Rastreio de Movimentações (Exclusivo Master)", 14, 25);
    doc.text(`Filtro: ${dataInicio || "Início"} até ${dataFim || "Fim"} | Aba: ${abaTipo.toUpperCase()} | Total: ${logsFiltrados.length} registros`, 14, 31);

    autoTable(doc, {
      startY: 36,
      head: [["Data/Hora", "Tipo", "Item / Ação / Alteração", "Cliente / Cartão", "Operador / Perfil", "Valor (R$)"]],
      body: logsFiltrados.map(log => [
        new Date(log.criadaEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }),
        log.tipo === 'AUDITORIA_SUPORTE' ? 'SUPORTE OP.' : log.tipo === 'HISTORICO_PRECO' ? 'ALT. PREÇO' : log.tipo,
        formatarDescricaoLog(log),
        log.cartao ? `${log.cartao.cliente?.nome || '—'} (${log.cartao.codigo})` : '—',
        `${log.operador?.nome || log.operadorNome || 'Sistema'} (${log.operador?.role || (log.tipo === 'AUDITORIA_SUPORTE' ? 'SUPORTE_OPERACIONAL' : 'Online')})`,
        `R$ ${Number(log.valor || 0).toFixed(2).replace('.', ',')}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [29, 52, 97], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8 }
    });

    doc.save(`LaMore_Auditoria_${abaTipo}_${eventoId || 'Geral'}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#1D3461] mb-1">Auditoria do Sistema</h2>
          <p className="text-gray-500 text-sm sm:text-base font-semibold">
            Rastreabilidade completa de recargas, consumos, estornos e ações do Suporte Operacional (Exclusivo Master)
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button onClick={exportarXLSX} className="bg-green-600 hover:bg-green-700 text-white font-black text-sm px-5 py-3 rounded-2xl transition-all shadow-sm flex items-center gap-2 cursor-pointer">
            <span>📊</span> Exportar Excel ({logsFiltrados.length})
          </button>
          <button onClick={exportarPDF} className="bg-red-600 hover:bg-red-700 text-white font-black text-sm px-5 py-3 rounded-2xl transition-all shadow-sm flex items-center gap-2 cursor-pointer">
            <span>📄</span> Exportar PDF
          </button>
        </div>
      </div>

      {/* Abas de Rastreio */}
      <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border-2 border-gray-100 shadow-sm mb-6">
        <button
          onClick={() => setAbaTipo('todos')}
          className={`px-4 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
            abaTipo === 'todos' ? 'bg-[#1D3461] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>📋 Todas as Movimentações</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${abaTipo === 'todos' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {logs.length}
          </span>
        </button>

        <button
          onClick={() => setAbaTipo('suporte')}
          className={`px-4 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
            abaTipo === 'suporte' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>🛠️ Rastreio Suporte Operacional</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${abaTipo === 'suporte' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'}`}>
            {totalSuporte}
          </span>
        </button>

        <button
          onClick={() => setAbaTipo('precos')}
          className={`px-4 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
            abaTipo === 'precos' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>💲 Alterações de Preços</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${abaTipo === 'precos' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
            {totalPrecos}
          </span>
        </button>

        <button
          onClick={() => setAbaTipo('financeiro')}
          className={`px-4 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
            abaTipo === 'financeiro' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>💳 Financeiro (Recargas/Bar/Estornos)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${abaTipo === 'financeiro' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'}`}>
            {totalFinanceiro}
          </span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Filtrar por Evento</label>
            <select
              value={eventoId}
              onChange={(e) => {
                setEventoId(e.target.value);
                localStorage.setItem("activeEventoId", e.target.value);
              }}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 font-bold text-[#1D3461] outline-none focus:border-[#1D3461]"
            >
              <option value="">Todos os Eventos</option>
              {eventos.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Data Inicial</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 font-semibold text-gray-900 outline-none focus:border-[#1D3461]"/>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Data Final</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 font-semibold text-gray-900 outline-none focus:border-[#1D3461]"/>
          </div>
        </div>

        {/* Busca Rápida em Tempo Real */}
        <div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔍 Buscar por nome do cliente, CPF, código do cartão, produto, operador ou ação realizada..."
            className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#1D3461] rounded-2xl px-5 py-3 font-semibold text-gray-900 outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-[#1D3461] text-xl font-bold">Carregando todas as movimentações...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
            <span>Listando {logsFiltrados.length} de {logs.length} movimentações</span>
          </div>
          <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-100 text-gray-500 font-bold z-10">
                <tr>
                  <th className="p-4 text-xs">Data & Hora</th>
                  <th className="p-4 text-xs">Tipo</th>
                  <th className="p-4 text-xs">Detalhes / Ação</th>
                  <th className="p-4 text-xs">Cliente / Cartão</th>
                  <th className="p-4 text-xs">Operador / Perfil</th>
                  <th className="p-4 text-xs text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                {logsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-400 font-bold">Nenhum registro encontrado.</td>
                  </tr>
                ) : (
                  logsFiltrados.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(log.criadaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}{' '}
                        <span className="font-bold text-gray-900">{new Date(log.criadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap ${
                          log.tipo === 'RECARGA' ? 'bg-green-100 text-green-800' :
                          log.tipo === 'DEBITO' ? 'bg-blue-100 text-blue-800' :
                          log.tipo === 'AUDITORIA_SUPORTE' ? 'bg-teal-100 text-teal-800 border border-teal-300' :
                          log.tipo === 'HISTORICO_PRECO' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {log.tipo === 'AUDITORIA_SUPORTE' ? '🛠️ SUPORTE OP.' : log.tipo === 'HISTORICO_PRECO' ? '💲 ALT. PREÇO' : log.tipo}
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        <p className="font-black text-gray-900">{formatarDescricaoLog(log)}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {log.produto?.grupo && (
                            <span className="text-xs text-gray-400 font-semibold uppercase">{log.produto.grupo}</span>
                          )}
                          {log.eventoNome && (
                            <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold">
                              🎪 {log.eventoNome}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm">
                        <p className="font-black text-gray-950">{log.cartao?.cliente?.nome || '—'}</p>
                        {log.cartao?.codigo && (
                          <p className="text-purple-700 font-mono font-bold text-xs">Cartão: {log.cartao.codigo}</p>
                        )}
                        {(log.cartao?.cliente?.cpf || log.cartao?.cliente?.celular) && (
                          <p className="text-gray-500 font-semibold text-[11px] mt-0.5">
                            {log.cartao?.cliente?.cpf && `CPF: ${log.cartao.cliente.cpf}`}
                            {log.cartao?.cliente?.cpf && log.cartao?.cliente?.celular && ' • '}
                            {log.cartao?.cliente?.celular && `Tel: ${log.cartao.cliente.celular}`}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-sm">
                        <p className="font-bold text-gray-800">{log.operador?.nome || log.operadorNome || 'Sistema'}</p>
                        <p className="text-gray-400 text-xs font-bold uppercase">
                          {log.operador?.role?.replace('_', ' ') || (log.tipo === 'AUDITORIA_SUPORTE' ? 'SUPORTE OPERACIONAL' : 'Online')}
                        </p>
                      </td>
                      <td className={`p-4 font-black text-right text-base whitespace-nowrap ${
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
