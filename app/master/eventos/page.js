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
  const [exibirAvisoSaldo, setExibirAvisoSaldo] = useState(true);
  const [textoAvisoSaldo, setTextoAvisoSaldo] = useState('Não há devolução de saldo ao final da festa, porém o saldo positivo pode ser utilizado durante todos os dias da festa.');
  const [gatewayActive, setGatewayActive] = useState('NENHUM');
  const [chavePix, setChavePix] = useState('');
  const [tipoChavePix, setTipoChavePix] = useState('CPF');
  const [titularPix, setTitularPix] = useState('');
  const [cidadePix, setCidadePix] = useState('BRASILIA');
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [asaasToken, setAsaasToken] = useState('');
  const [bilheteriaEventoId, setBilheteriaEventoId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sincronizandoId, setSincronizandoId] = useState(null);
  
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
    
    // Ler parâmetros da URL para exibir toasts/banners após o login OAuth do Mercado Pago
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const success = params.get('success');
      const err = params.get('error');
      if (success === 'mercadopago_connected') {
        setSuccessMsg('Conta Mercado Pago do Produtor vinculada com sucesso! 🔌🎉');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (err) {
        if (err === 'mercadopago_auth_failed') {
          setError('A autorização com o Mercado Pago foi cancelada ou recusada.');
        } else if (err === 'token_exchange_failed') {
          setError('Não foi possível converter o código de autorização em tokens do Mercado Pago.');
        } else if (err === 'callback_error') {
          setError('Ocorreu um erro inesperado ao processar a resposta do Mercado Pago.');
        } else {
          setError('Falha ao vincular a conta Mercado Pago.');
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
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
    setExibirAvisoSaldo(true);
    setTextoAvisoSaldo('Não há devolução de saldo ao final da festa, porém o saldo positivo pode ser utilizado durante todos os dias da festa.');
    setGatewayActive('NENHUM');
    setChavePix('');
    setTipoChavePix('CPF');
    setTitularPix('');
    setCidadePix('BRASILIA');
    setMpPublicKey('');
    setMpAccessToken('');
    setAsaasToken('');
    setBilheteriaEventoId('');
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
    setExibirAvisoSaldo(evt.exibirAvisoSaldo !== undefined ? evt.exibirAvisoSaldo : true);
    setTextoAvisoSaldo(evt.textoAvisoSaldo || 'Não há devolução de saldo ao final da festa, porém o saldo positivo pode ser utilizado durante todos os dias da festa.');
    setGatewayActive(evt.gatewayActive || (evt.chavePix ? 'PIX_DIRETO' : 'NENHUM'));
    setChavePix(evt.chavePix || '');
    setTipoChavePix(evt.tipoChavePix || 'CPF');
    setTitularPix(evt.titularPix || '');
    setCidadePix(evt.cidadePix || 'BRASILIA');
    setMpPublicKey(evt.mercadoPagoPublicKey || '');
    setMpAccessToken(evt.mercadoPagoAccessToken || '');
    setAsaasToken(evt.asaasToken || '');
    setBilheteriaEventoId(evt.bilheteriaEventoId || '');
    setMostrarModal(true);
  };

  const sincronizarBilheteria = async (id) => {
    setSincronizandoId(id);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/integracao/bilheteria/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventoId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`✔ Sincronização concluída: ${data.novosImportados} novo(s) cartão(ões) importado(s) da bilheteria! (${data.jaSincronizados} já estavam sincronizados). Total importado: R$ ${(data.valorTotalImportado || 0).toFixed(2).replace('.', ',')}`);
        carregarEventos();
      } else {
        setError(data.error || 'Erro ao sincronizar com a bilheteria.');
      }
    } catch (e) {
      setError('Falha de conexão com a bilheteria.');
    } finally {
      setSincronizandoId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const acaoTexto = eventoParaEditar
      ? `Você quer realmente salvar as alterações do evento "${nome}"?`
      : `Você quer realmente criar o novo evento "${nome}"?`;
    if (!window.confirm(acaoTexto)) return;

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
          permitirEdicaoGateway,
          exibirAvisoSaldo,
          textoAvisoSaldo: textoAvisoSaldo.trim() || 'Não há devolução de saldo ao final da festa, porém o saldo positivo pode ser utilizado durante todos os dias da festa.',
          gatewayActive,
          chavePix: gatewayActive === 'NENHUM' ? null : chavePix,
          tipoChavePix,
          titularPix: gatewayActive === 'NENHUM' ? null : titularPix,
          cidadePix: gatewayActive === 'NENHUM' ? 'BRASILIA' : cidadePix,
          asaasToken: gatewayActive === 'NENHUM' ? null : asaasToken,
          mercadoPagoPublicKey: gatewayActive === 'NENHUM' ? null : mpPublicKey,
          mercadoPagoAccessToken: gatewayActive === 'NENHUM' ? null : mpAccessToken,
          mercadoPagoUserId: gatewayActive === 'NENHUM' ? null : (eventoParaEditar?.mercadoPagoUserId || null),
          bilheteriaEventoId: bilheteriaEventoId || null,
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
        setGatewayActive('NENHUM');
        setChavePix('');
        setTipoChavePix('CPF');
        setTitularPix('');
        setCidadePix('BRASILIA');
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
    const labelStatus = proximoStatus === 'ATIVO' ? 'ATIVAR' : proximoStatus === 'ENCERRADO' ? 'ENCERRAR' : 'REABRIR/CONFIGURAR';
    if (!window.confirm(`Você quer realmente ${labelStatus} este evento?`)) return;

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
    if (!window.confirm(`Você quer realmente alterar o modo de operação para "${proximoModo}"?`)) return;

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
    if (window.confirm(`Você quer realmente excluir este evento "${nome}"?\n\nTEM CERTEZA ABSOLUTA? Isso apagará TODOS os cartões, vendas, e clientes atrelados a ele! Essa ação NÃO PODE ser desfeita.`)) {
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
    if (window.confirm('⚠️ ALERTA VERMELHO ⚠️\n\nVocê quer realmente APAGAR TODOS os Cartões, Vendas, Clientes e Operadores do sistema?\n(O seu usuário Master e o Evento continuarão intactos).')) {
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
    if (window.confirm('ATENÇÃO: Você quer realmente encerrar e apagar TODOS os Caixas, Operadores de Bar, Tesourarias e Cartões deste evento?\n\nOs clientes base serão mantidos. Esta ação não tem volta. Deseja continuar?')) {
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
                    <div className="mt-2 inline-flex items-center gap-2 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg text-xs font-mono text-gray-600">
                      <span>ID: <strong className="text-gray-900">{evt.id}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(evt.id);
                          alert(`ID copiado: ${evt.id}`);
                        }}
                        className="text-[#ff5500] hover:underline font-sans text-[11px] font-black cursor-pointer ml-1"
                        title="Copiar ID para usar na Bilheteria"
                      >
                        Copiar ID
                      </button>
                    </div>
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

                {evt.gatewayActive === 'MERCADO_PAGO' ? (
                  <div className={`mt-3 p-3 rounded-xl border flex items-center justify-between text-xs font-bold mb-3 ${
                    evt.mercadoPagoUserId 
                      ? 'bg-green-50 border-green-200 text-green-700' 
                      : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                  }`}>
                    <div className="flex items-center gap-1.5 truncate">
                      <span>🔌 MP Split:</span>
                      <span className="truncate">{evt.mercadoPagoUserId ? `Conectado (ID: ${evt.mercadoPagoUserId})` : 'Pendente Conexão'}</span>
                    </div>
                    <button
                      onClick={() => {
                        const clientId = process.env.NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID;
                        if (!clientId || clientId === '1234567890') {
                          alert('Configure a variável NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID no painel do Railway para vincular o Mercado Pago.');
                          return;
                        }
                        const origin = typeof window !== 'undefined' ? window.location.origin : '';
                        const redirectUri = encodeURIComponent(`${origin}/api/auth/mercadopago/callback`);
                        const url = `https://auth.mercadopago.com.br/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${evt.id}&redirect_uri=${redirectUri}`;
                        window.location.href = url;
                      }}
                      className="px-2.5 py-1 rounded-lg font-bold transition-all shadow-sm shrink-0 bg-[#1D3461] hover:bg-[#112244] text-white cursor-pointer"
                    >
                      {evt.mercadoPagoUserId ? 'Reconectar' : 'Vincular'}
                    </button>
                  </div>
                ) : evt.gatewayActive === 'PIX_DIRETO' ? (
                  <div className="mt-3 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-emerald-800 text-xs font-bold flex items-center justify-between mb-3">
                    <span className="flex items-center gap-1"><span>⚡</span> PIX Direto ({evt.tipoChavePix || 'CPF'})</span>
                    <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 truncate max-w-[140px]">{evt.chavePix || 'Chave cadastrada'}</span>
                  </div>
                ) : evt.gatewayActive === 'ASAAS' ? (
                  <div className="mt-3 p-2.5 rounded-xl border border-blue-200 bg-blue-50/60 text-blue-800 text-xs font-bold flex items-center justify-between mb-3">
                    <span className="flex items-center gap-1"><span>⚡</span> Asaas Gateway</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-blue-200">API Ativa</span>
                  </div>
                ) : (
                  <div className="mt-3 p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 text-xs font-bold flex items-center justify-between mb-3">
                    <span className="flex items-center gap-1"><span>🚫</span> Modo Gerencial</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-gray-200">Sem gateway online</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
                <div className="flex justify-between items-center text-gray-400 text-sm font-semibold">
                  <span>📅 {new Date(evt.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                  {evt.bilheteriaEventoId && (
                    <span className="text-[11px] bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full font-bold">
                      🎟️ Bilheteria Conectada
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => sincronizarBilheteria(evt.id)}
                  disabled={sincronizandoId === evt.id}
                  className="w-full bg-[#ff5500] hover:bg-[#e04b00] text-white font-black text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {sincronizandoId === evt.id ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Sincronizando com a Bilheteria...
                    </>
                  ) : (
                    <>
                      🔄 Sincronizar Vendas Bilheteria
                    </>
                  )}
                </button>
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

                <div className="pt-2 border-t border-gray-200 space-y-2.5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exibirAvisoSaldo}
                      onChange={(e) => setExibirAvisoSaldo(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-[#1D3461] focus:ring-[#1D3461] shrink-0"
                    />
                    <div>
                      <p className="font-bold text-gray-800 text-sm">Exibir aviso sobre regra de uso do saldo no Cartão Digital</p>
                      <p className="text-xs text-gray-500 font-semibold">Permite incluir ou ocultar o aviso no cartão de cada festa e personalizar a mensagem de saldo.</p>
                    </div>
                  </label>

                  {exibirAvisoSaldo && (
                    <div>
                      <label className="block text-gray-700 font-bold mb-1 text-xs">Texto do aviso no Cartão Digital (editável por festa)</label>
                      <textarea
                        rows={3}
                        value={textoAvisoSaldo}
                        onChange={(e) => setTextoAvisoSaldo(e.target.value)}
                        placeholder="Não há devolução de saldo ao final da festa, porém o saldo positivo pode ser utilizado durante todos os dias da festa."
                        className="w-full bg-white border-2 border-gray-200 focus:border-[#1D3461] outline-none rounded-xl px-3 py-2 text-xs font-semibold text-gray-900"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* CONFIGURAÇÃO DE RECEBIMENTO PIX / GATEWAY */}
              <div className="bg-amber-500/10 border-2 border-amber-500/30 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[#1D3461] font-black text-sm uppercase tracking-wider flex items-center gap-2">
                    <span>⚡</span> Configuração de Recebimento PIX (PF / PJ)
                  </h4>
                  <span className="text-[10px] font-bold bg-amber-500/20 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    Acesso Master Exclusivo
                  </span>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1 text-xs">Método de Recebimento Ativo</label>
                  <select
                    value={gatewayActive}
                    onChange={(e) => setGatewayActive(e.target.value)}
                    className="w-full bg-white border-2 border-amber-200 focus:border-[#1D3461] outline-none rounded-xl px-3 py-2.5 font-bold text-sm text-gray-900 cursor-pointer"
                  >
                    <option value="NENHUM">🚫 Nenhum / Não utilizado (Modo Gerencial)</option>
                    <option value="PIX_DIRETO">⚡ PIX Direto (Chave Própria PF/PJ - Padrão)</option>
                    <option value="MERCADO_PAGO">Mercado Pago (OAuth / Split)</option>
                    <option value="ASAAS">Asaas Gateway</option>
                    <option value="PAGBANK">PagBank (PagSeguro)</option>
                  </select>
                </div>

                {gatewayActive === 'NENHUM' && (
                  <div className="p-3 bg-white/90 rounded-xl border border-amber-200 text-xs text-gray-700 font-semibold space-y-1">
                    <p className="font-bold text-[#1D3461] flex items-center gap-1.5">
                      <span>🚫</span> Nenhum método de recebimento online ativo
                    </p>
                    <p className="text-gray-500 text-[11px] leading-relaxed">
                      Chaves PIX e credenciais de API ficam desativadas. Ideal para modo gerencial e eventos onde todas as transações são físicas ou sem cobrança via aplicativo.
                    </p>
                  </div>
                )}

                {gatewayActive === 'PIX_DIRETO' && (
                  <div className="space-y-3 pt-2 border-t border-amber-500/20">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-gray-700 font-bold mb-1 text-xs">Tipo de Chave</label>
                        <select
                          value={tipoChavePix}
                          onChange={(e) => setTipoChavePix(e.target.value)}
                          className="w-full bg-white border-2 border-gray-200 focus:border-[#1D3461] outline-none rounded-xl px-3 py-2 text-xs font-semibold text-gray-900"
                        >
                          <option value="CPF">CPF (Pessoa Física)</option>
                          <option value="CNPJ">CNPJ (Pessoa Jurídica)</option>
                          <option value="EMAIL">E-mail</option>
                          <option value="TELEFONE">Celular / Telefone</option>
                          <option value="ALEATORIA">Chave Aleatória (EVP)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-gray-700 font-bold mb-1 text-xs">Chave PIX para Recebimento *</label>
                        <input
                          type="text"
                          value={chavePix}
                          onChange={(e) => setChavePix(e.target.value)}
                          placeholder={tipoChavePix === 'CPF' ? 'Ex: 000.000.000-00' : (tipoChavePix === 'EMAIL' ? 'pix@produtor.com' : 'Informe a chave PIX')}
                          className="w-full bg-white border-2 border-amber-300 focus:border-[#1D3461] outline-none rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-700 font-bold mb-1 text-xs">Nome do Titular da Conta (PF / PJ)</label>
                        <input
                          type="text"
                          value={titularPix}
                          onChange={(e) => setTitularPix(e.target.value)}
                          placeholder="Ex: LEONARDO CAVALCANTI"
                          className="w-full bg-white border-2 border-gray-200 focus:border-[#1D3461] outline-none rounded-xl px-3 py-2 text-xs font-semibold text-gray-900"
                        />
                      </div>

                      <div>
                        <label className="block text-gray-700 font-bold mb-1 text-xs">Cidade do Titular</label>
                        <input
                          type="text"
                          value={cidadePix}
                          onChange={(e) => setCidadePix(e.target.value)}
                          placeholder="Ex: BRASILIA"
                          className="w-full bg-white border-2 border-gray-200 focus:border-[#1D3461] outline-none rounded-xl px-3 py-2 text-xs font-semibold text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {gatewayActive === 'ASAAS' && (
                  <div className="space-y-3 pt-2 border-t border-amber-500/20">
                    <div>
                      <label className="block text-gray-700 font-bold mb-1 text-xs">Chave de API do Asaas (Produção / Sandbox) *</label>
                      <input
                        type="text"
                        value={asaasToken}
                        onChange={(e) => setAsaasToken(e.target.value)}
                        placeholder="$aact_prod_..."
                        className="w-full bg-white border-2 border-amber-300 focus:border-[#1D3461] outline-none rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900"
                      />
                      <p className="text-[10px] text-gray-600 mt-1 font-semibold">
                        Habilita Pix Dinâmico (QR Code + Copia e Cola) e Cartão de Crédito/Débito Integrado via API.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {gatewayActive !== 'NENHUM' && (
                <>
                  <div>
                    <label className="block text-gray-500 font-bold mb-1 text-sm">Mercado Pago Public Key</label>
                    <input
                      type="text"
                      value={mpPublicKey}
                      onChange={(e) => setMpPublicKey(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900 placeholder-gray-400"
                      placeholder="Ex: APP_USR-..."
                    />
                  </div>

                  <div>
                    <label className="block text-gray-500 font-bold mb-1 text-sm">Mercado Pago Access Token</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={mpAccessToken}
                      onChange={(e) => setMpAccessToken(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900 placeholder-gray-400"
                      placeholder="Ex: APP_USR-..."
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-gray-500 font-bold mb-1 text-sm">
                  ID do Evento na Bilheteria <span className="text-xs text-gray-400 font-normal">(Opcional para sincronização com bilheteria)</span>
                </label>
                <input
                  type="text"
                  value={bilheteriaEventoId}
                  onChange={(e) => setBilheteriaEventoId(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Ex: evt_... ou slug do evento"
                />
              </div>

              {eventoParaEditar && gatewayActive === 'MERCADO_PAGO' && (
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
                      const clientId = process.env.NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID;
                      if (!clientId || clientId === '1234567890') {
                        alert('Configure a variável NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID no painel do Railway para vincular o Mercado Pago.');
                        return;
                      }
                      const origin = typeof window !== 'undefined' ? window.location.origin : '';
                      const redirectUri = encodeURIComponent(`${origin}/api/auth/mercadopago/callback`);
                      const url = `https://auth.mercadopago.com.br/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${eventoParaEditar.id}&redirect_uri=${redirectUri}`;
                      window.location.href = url;
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow cursor-pointer"
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
