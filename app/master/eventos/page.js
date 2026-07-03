"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MasterEventos() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form states
  const [nome, setNome] = useState('');
  const [data, setData] = useState('');
  const [local, setLocal] = useState('');
  const [taxa, setTaxa] = useState('5.0');

  const [permiteDevolucao, setPermiteDevolucao] = useState(false);
  const [permitirEdicaoGateway, setPermitirEdicaoGateway] = useState(false);
  const [salvando, setSalvando] = useState(false);
  
  // Modal states
  const [mostrarModal, setMostrarModal] = useState(false);
  const [eventoParaEditar, setEventoParaEditar] = useState(null);
  
  // QR Code Modal State
  const [mostrarQrModal, setMostrarQrModal] = useState(false);
  const [eventoQr, setEventoQr] = useState(null);
  
  // Notification states
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    carregarEventos();
    

  }, []);

  const carregarEventos = async () => {
    try {
      const res = await fetch('/api/eventos');
      const data = await res.json();
      if (data.error) setError(data.error);
      else setEventos(data);
    } catch (e) {
      setError('Erro ao conectar com a API');
    } finally {
      setLoading(false);
    }
  };

  const abrirCriar = () => {
    setEventoParaEditar(null);
    setNome('');
    setData('');
    setLocal('');
    setTaxa('5.0');

    setPermiteDevolucao(false);
    setPermitirEdicaoGateway(false);
    setMostrarModal(true);
  };

  const abrirEditar = (evt) => {
    setEventoParaEditar(evt);
    setNome(evt.nome || '');
    setData(evt.data ? new Date(evt.data).toISOString().split('T')[0] : '');
    setLocal(evt.local || '');
    setTaxa(evt.taxaMasterPercent?.toString() || '5.0');

    setPermiteDevolucao(evt.permiteDevolucao || false);
    setPermitirEdicaoGateway(evt.permitirEdicaoGateway || false);
    setMostrarModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setError('');

    const url = eventoParaEditar ? `/api/eventos/${eventoParaEditar.id}` : '/api/eventos';
    const method = eventoParaEditar ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          data,
          local,
          taxaMasterPercent: parseFloat(taxa),

          permiteDevolucao,
          permitirEdicaoGateway
        })
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error);
      } else {
        setNome('');
        setData('');
        setLocal('');
        setTaxa('5.0');
        setMostrarModal(false);
        setEventoParaEditar(null);
        carregarEventos();
      }
    } catch (e) {
      setError(eventoParaEditar ? 'Erro ao salvar alterações' : 'Erro ao criar evento');
    } finally {
      setSalvando(false);
    }
  };

  const handleMudarStatus = async (id, statusAtual) => {
    const proximoStatus = statusAtual === 'CONFIGURANDO' ? 'ATIVO' : statusAtual === 'ATIVO' ? 'ENCERRADO' : 'CONFIGURANDO';
    try {
      const res = await fetch(`/api/eventos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: proximoStatus })
      });
      if (res.ok) carregarEventos();
    } catch (e) {
      console.error('Erro ao atualizar status', e);
    }
  };

  const handleMudarModoOperacao = async (id, modoAtual) => {
    const proximoModo = modoAtual === 'INTEGRADO' ? 'GERENCIAL' : 'INTEGRADO';
    try {
      const res = await fetch(`/api/eventos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modoOperacao: proximoModo })
      });
      if (res.ok) carregarEventos();
    } catch (e) {
      console.error('Erro ao atualizar modo de operacao', e);
    }
  };

  const handleExcluir = async (id, nome) => {
    if (window.confirm(`TEM CERTEZA ABSOLUTA que deseja EXCLUIR o evento "${nome}"?\n\nIsso apagará TODOS os cartões, vendas, e clientes atrelados a ele! Essa ação NÃO PODE ser desfeita.`)) {
      setLoading(true);
      try {
        const res = await fetch(`/api/eventos/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          carregarEventos();
        } else {
          const data = await res.json();
          setError(data.error || 'Erro ao excluir evento');
          setLoading(false);
        }
      } catch (e) {
        setError('Erro ao excluir evento');
        setLoading(false);
      }
    }
  };

  const handleLimparBanco = async () => {
    if (window.confirm('⚠️ ALERTA VERMELHO ⚠️\n\nTem certeza que deseja APAGAR TODOS os Cartões, Vendas, Clientes e Operadores do sistema?\n(O seu usuário Master e o Evento continuarão intactos).')) {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/limpar', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg(data.message);
          carregarEventos();
        } else {
          setError(data.error || 'Erro ao limpar banco de dados');
          setLoading(false);
        }
      } catch (e) {
        setError('Erro de conexão ao limpar o banco');
        setLoading(false);
      }
    }
  };

  const handleLimparEvento = async (id) => {
    if (window.confirm('ATENÇÃO: Você está prestes a apagar TODOS os Caixas, Operadores de Bar, Tesourarias e Cartões deste evento.\n\nOs clientes base serão mantidos. Esta ação não tem volta. Deseja continuar?')) {
      setLoading(true);
      try {
        const res = await fetch(`/api/eventos/${id}/limpar`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg(`${data.message}. Foram apagados ${data.cartoesDeletados} cartões e ${data.operadoresDeletados} operadores.`);
          carregarEventos();
        } else {
          setError(data.error || 'Erro ao limpar o evento');
          setLoading(false);
        }
      } catch (e) {
        setError('Erro de conexão ao limpar o evento');
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-4xl font-black text-[#1D3461] mb-2">Eventos</h2>
          <p className="text-gray-500 text-lg font-semibold">Gerencie e configure os eventos da plataforma</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={handleLimparBanco}
            className="w-full sm:w-auto bg-red-100 border-2 border-red-500 hover:bg-red-500 hover:text-white text-red-600 font-black px-4 py-3 rounded-2xl transition-all shadow-sm text-sm flex items-center justify-center gap-2"
          >
            <span>🧹</span> Limpar Dados de Teste
          </button>
          <button
            onClick={abrirCriar}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-black px-6 py-3 rounded-2xl transition-all shadow-lg hover:shadow-green-700/20 text-lg flex items-center justify-center gap-2"
          >
            <span>➕</span> Novo Evento
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold flex items-center gap-3">
          <span>⚠️</span> {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-500/10 border-2 border-green-500/20 text-green-700 p-4 rounded-2xl mb-6 font-bold flex items-center gap-3 animate-in fade-in duration-200">
          <span>✅</span> {successMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-[#1D3461] text-xl font-bold">Carregando eventos...</p>
        </div>
      ) : eventos.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border-2 border-gray-100">
          <span className="text-6xl block mb-4">🎪</span>
          <p className="text-gray-400 text-xl font-bold">Nenhum evento cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {eventos.map((evt) => (
            <div key={evt.id} className="bg-white rounded-3xl p-6 border-2 border-gray-100 hover:border-[#1D3461] transition-all shadow-sm hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-2xl text-gray-900">{evt.nome}</h3>
                    <p className="text-gray-500 font-semibold">{evt.local || 'Local não informado'}</p>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-sm font-black ${
                    evt.status === 'ATIVO' ? 'bg-green-100 text-green-700' :
                    evt.status === 'CONFIGURANDO' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {evt.status}
                  </span>
                </div>
                <div className="mb-4 text-center">
                  <button
                    onClick={() => handleMudarModoOperacao(evt.id, evt.modoOperacao || 'INTEGRADO')}
                    className={`w-full py-2.5 rounded-xl font-black text-sm transition-all border-2 flex items-center justify-center gap-2 ${
                      (evt.modoOperacao || 'INTEGRADO') === 'INTEGRADO' 
                        ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100' 
                        : 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100'
                    }`}
                  >
                    <span>{(evt.modoOperacao || 'INTEGRADO') === 'INTEGRADO' ? '🔌 Modo Integrado' : '📇 Modo Gerencial'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-2xl p-4 mb-4 text-center">
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase">Cartões</p>
                    <p className="text-gray-950 font-black text-lg">{evt._count?.cartoes || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase">Produtos</p>
                    <p className="text-gray-950 font-black text-lg">{evt._count?.produtos || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase">Taxa Master</p>
                    <p className="text-gray-950 font-black text-lg">{evt.taxaMasterPercent}%</p>
                  </div>
                </div>


              </div>

              <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
                <div className="flex justify-between items-center text-gray-400 text-sm font-semibold">
                  <span>📅 {new Date(evt.data).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => abrirEditar(evt)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm px-4 py-2.5 rounded-xl transition-all"
                  >
                    ✏️ Editar Detalhes
                  </button>
                  <button
                    onClick={() => handleMudarStatus(evt.id, evt.status)}
                    className="flex-1 text-[#1D3461] hover:bg-[#1D3461]/10 px-4 py-2.5 rounded-xl transition-all font-bold text-sm border-2 border-[#1D3461]/10"
                  >
                    {evt.status === 'ATIVO' ? '⏸️ Pausar' : '▶️ Ativar'}
                  </button>
                  <button
                    onClick={() => handleExcluir(evt.id, evt.nome)}
                    className="flex-none bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl transition-all font-bold text-sm"
                    title="Excluir Evento"
                  >
                    🗑️
                  </button>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={() => {
                      setEventoQr(evt);
                      setMostrarQrModal(true);
                    }}
                    className="w-full bg-[#1D3461]/10 hover:bg-[#1D3461] text-[#1D3461] hover:text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all"
                  >
                    📱 QR Code Auto-Cadastro
                  </button>
                  <button
                    onClick={() => handleLimparEvento(evt.id)}
                    className="w-full bg-red-100 border border-red-200 hover:bg-red-600 hover:border-red-600 text-red-700 hover:text-white font-bold text-sm px-4 py-2 rounded-xl transition-all"
                  >
                    🧹 Encerrar e Limpar Evento
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar/Editar Evento */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200 scrollbar-thin">
            <h3 className="text-2xl font-black text-[#1D3461] mb-6 flex items-center gap-2">
              <span>🎪</span> {eventoParaEditar ? 'Editar Evento' : 'Novo Evento'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-500 font-bold mb-1 text-sm">Nome do Evento</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Ex: La More Summer Party"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-500 font-bold mb-1 text-sm">Data</label>
                  <input
                    type="date"
                    required
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 font-bold mb-1 text-sm">Taxa Master (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={taxa}
                    onChange={(e) => setTaxa(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1 text-sm">Local</label>
                <input
                  type="text"
                  required
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Ex: Salão de Festas Principal"
                />
              </div>



              <div className="bg-gray-50 p-4 rounded-2xl border-2 border-gray-100 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permiteDevolucao}
                    onChange={(e) => setPermiteDevolucao(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#1D3461] focus:ring-[#1D3461]"
                  />
                  <div>
                    <p className="font-bold text-gray-800 text-sm">Permitir Devoluções de Saldo (Master e APP)</p>
                    <p className="text-xs text-gray-500 font-semibold">Ativa o módulo de reembolso via PIX.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permitirEdicaoGateway}
                    onChange={(e) => setPermitirEdicaoGateway(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#1D3461] focus:ring-[#1D3461]"
                  />
                  <div>
                    <p className="font-bold text-gray-800 text-sm">Permitir que Produtor configure as API Keys do Gateway</p>
                    <p className="text-xs text-gray-500 font-semibold">Se desativado, apenas o Master poderá configurar as chaves do Asaas/Mercado Pago.</p>
                  </div>
                </label>
              </div>

              {!eventoParaEditar && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs font-semibold text-gray-500 leading-normal">
                  💡 A vinculação da conta Mercado Pago do produtor via OAuth (Split) estará disponível após a criação do evento, ao editar seus detalhes.
                </div>
              )}

              {eventoParaEditar && (
                <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-4 text-center mt-2">
                  <p className="text-blue-900 font-black text-sm mb-1">🔌 Mercado Pago Connect (Split)</p>
                  <p className="text-xs text-blue-700 mb-3 leading-tight">
                    {eventoParaEditar.mercadoPagoUserId 
                      ? `Conta conectada (ID: ${eventoParaEditar.mercadoPagoUserId})` 
                      : "Vincule a conta Mercado Pago do produtor para split automático."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const clientId = process.env.NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID || '1234567890';
                      const redirectUri = encodeURIComponent(process.env.NEXT_PUBLIC_MERCADOPAGO_REDIRECT_URI || 'http://localhost:3000/api/auth/mercadopago/callback');
                      const url = `https://auth.mercadopago.com.br/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${eventoParaEditar.id}&redirect_uri=${redirectUri}`;
                      window.location.href = url;
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow"
                  >
                    {eventoParaEditar.mercadoPagoUserId ? "Reconectar Conta" : "Conectar Conta do Produtor"}
                  </button>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 font-black py-3 rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 bg-[#1D3461] hover:bg-[#112244] text-white font-black py-3 rounded-2xl transition-all disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {mostrarQrModal && eventoQr && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <h3 className="text-xl font-black text-[#1D3461] mb-2">QR Code de Cadastro</h3>
            <p className="text-sm text-gray-500 mb-6 font-semibold">{eventoQr.nome}</p>
            
            <div className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-100 mb-6 flex justify-center">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent((typeof window !== 'undefined' ? window.location.origin : '') + '/e/' + eventoQr.id)}`} 
                alt="QR Code Auto-Cadastro" 
                className="w-48 h-48 object-contain rounded-xl"
              />
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent((typeof window !== 'undefined' ? window.location.origin : '') + '/e/' + eventoQr.id)}`;
                  link.download = `QRCode_${eventoQr.nome.replace(/\s+/g, '_')}.png`;
                  link.target = "_blank";
                  link.click();
                }}
                className="w-full bg-[#1D3461] hover:bg-blue-900 text-white font-black px-6 py-3.5 rounded-2xl transition-all flex justify-center items-center gap-2"
              >
                <span>⬇️</span> Baixar Imagem HD
              </button>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/e/${eventoQr.id}`);
                  alert('Link copiado para a área de transferência!');
                }}
                className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold px-6 py-3.5 rounded-2xl transition-all flex justify-center items-center gap-2"
              >
                <span>🔗</span> Copiar Link
              </button>

              <button
                onClick={() => setMostrarQrModal(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-6 py-3.5 rounded-2xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
