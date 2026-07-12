"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function MasterDevolucoesPage() {
  const { data: session } = useSession();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState(null);
  
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState("");

  useEffect(() => {
    carregarEventos();
  }, []);

  useEffect(() => {
    if (eventoId) {
      carregarSolicitacoes();
    }
  }, [eventoId]);

  const carregarEventos = async () => {
    try {
      const res = await fetch("/api/eventos");
      const data = await res.json();
      if (!data.error && data.length > 0) {
        setEventos(data);
        const stored = localStorage.getItem("activeEventoId");
        if (stored && data.some(e => e.id === stored)) {
          setEventoId(stored);
        } else {
          setEventoId(data[0].id);
          localStorage.setItem("activeEventoId", data[0].id);
        }
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleMudarEvento = (e) => {
    const novoId = e.target.value;
    setEventoId(novoId);
    localStorage.setItem("activeEventoId", novoId);
  };

  const carregarSolicitacoes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org/devolucoes?eventoId=${eventoId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSolicitacoes(data);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar devoluções");
    } finally {
      setLoading(false);
    }
  };

  const marcarComoConcluida = async (id) => {
    if (!confirm("Confirmar que você já enviou o PIX para este cliente?")) return;
    
    setProcessandoId(id);
    try {
      const res = await fetch("/api/org/devolucoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "CONCLUIDA" })
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      await carregarSolicitacoes();
    } catch (e) {
      alert(e.message);
    } finally {
      setProcessandoId(null);
    }
  };

  const exportarXLSX = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Devoluções");
    worksheet.columns = [
      { header: "Data/Hora", key: "data", width: 25 },
      { header: "Cliente", key: "cliente", width: 30 },
      { header: "Cartão", key: "cartao", width: 15 },
      { header: "Chave PIX", key: "pix", width: 30 },
      { header: "Valor (R$)", key: "valor", width: 15 },
      { header: "Status", key: "status", width: 15 },
    ];
    
    solicitacoes.forEach(s => {
      worksheet.addRow({
        data: new Date(s.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        cliente: s.cartao.cliente.nome,
        cartao: s.cartao.codigo,
        pix: s.chavePix,
        valor: s.valor.toFixed(2).replace('.', ','),
        status: s.status
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "Relatorio_Devolucoes.xlsx");
  };

  const exportarPDF = () => {
    const doc = new jsPDF("landscape");
    doc.text("Relatório de Devoluções de Saldo", 14, 15);
    const tableData = solicitacoes.map(s => [
      new Date(s.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      s.cartao.cliente.nome,
      s.cartao.codigo,
      s.chavePix,
      `R$ ${s.valor.toFixed(2).replace('.', ',')}`,
      s.status
    ]);
    autoTable(doc, {
      head: [["Data/Hora", "Cliente", "Cartão", "Chave PIX", "Valor", "Status"]],
      body: tableData,
      startY: 20
    });
    doc.save("Relatorio_Devolucoes.pdf");
  };

  const pendentes = solicitacoes.filter(s => s.status === 'PENDENTE');
  const concluidas = solicitacoes.filter(s => s.status === 'CONCLUIDA');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Devoluções de Saldo</h1>
          <p className="text-gray-500 text-sm">Gerencie os pedidos de reembolso solicitados pelos clientes no Cartão Digital.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <select
            value={eventoId}
            onChange={handleMudarEvento}
            className="w-full sm:w-auto bg-white border-2 border-gray-100 rounded-xl px-4 py-2 font-bold text-[#1D3461] outline-none"
          >
            {eventos.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.nome}</option>
            ))}
          </select>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={exportarXLSX}
              className="flex-1 sm:flex-none justify-center bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-3 sm:py-2 rounded-xl text-sm flex items-center gap-2"
            >
              <span>📊</span> Excel
            </button>
            <button
              onClick={exportarPDF}
              className="flex-1 sm:flex-none justify-center bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-3 sm:py-2 rounded-xl text-sm flex items-center gap-2"
            >
              <span>📄</span> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-sm font-bold text-gray-500 uppercase">Aguardando PIX</p>
          <p className="text-3xl font-black text-rose-600 mt-1">{pendentes.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-sm font-bold text-gray-500 uppercase">Devoluções Feitas</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{concluidas.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center font-bold">Carregando...</div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-black">
                <tr>
                  <th className="px-6 py-4">Data / Hora</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Chave PIX</th>
                  <th className="px-6 py-4 text-right">Valor a Devolver</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {solicitacoes.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-400 font-semibold">Nenhuma solicitação encontrada.</td>
                  </tr>
                ) : solicitacoes.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-600">
                      {new Date(s.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {s.cartao?.cliente?.nome || 'Cliente Excluído'}<br/>
                      <span className="text-xs text-gray-400 font-medium">Cartão: {s.cartao?.codigo || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-800 font-mono text-xs px-2 py-1 rounded-md border border-gray-200">
                        {s.chavePix}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-rose-600">
                      R$ {s.valor.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {s.status === 'PENDENTE' ? (
                        <span className="bg-rose-100 text-rose-700 font-bold text-xs px-3 py-1 rounded-full">PENDENTE</span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 font-bold text-xs px-3 py-1 rounded-full">PAGO</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {s.status === 'PENDENTE' && (
                        <button 
                          onClick={() => marcarComoConcluida(s.id)}
                          disabled={processandoId === s.id}
                          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
                        >
                          {processandoId === s.id ? '...' : '✔ Marcar Pago'}
                        </button>
                      )}
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
