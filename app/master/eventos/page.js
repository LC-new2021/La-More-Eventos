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
  const [salvando, setSalvando] = useState(false);
  
  // Modal states
  const [mostrarModal, setMostrarModal] = useState(false);
  const [eventoParaEditar, setEventoParaEditar] = useState(null);

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
    setMostrarModal(true);
  };

  const abrirEditar = (evt) => {
    setEventoParaEditar(evt);
    setNome(evt.nome || '');
    setData(evt.data ? new Date(evt.data).toISOString().split('T')[0] : '');
    setLocal(evt.local || '');
    setTaxa(evt.taxaMasterPercent?.toString() || '5.0');
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
          taxaMasterPercent: parseFloat(taxa)
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-[#1D3461] text-white flex flex-col z-10">
        <div className="p-6 border-b border-white/10">
          <Link href="/master" className="flex flex-col text-left group cursor-pointer focus:outline-none w-full">
            <h1 className="font-black text-xl leading-tight group-hover:text-blue-200 transition-colors">Lamore Eventos</h1>
            <p className="text-blue-300 text-sm font-semibold mt-0.5">Painel Master</p>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link href="/master" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-blue-100 hover:bg-white/10 hover:text-white transition-all font-semibold text-lg">
            <span>🏠</span> Dashboard
          </Link>
          <Link href="/master/eventos" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/10 text-white transition-all font-semibold text-lg">
            <span>🎪</span> Eventos
          </Link>
          <Link href="/master/usuarios" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-blue-100 hover:bg-white/10 hover:text-white transition-all font-semibold text-lg">
            <span>👥</span> Usuários
          </Link>
          <Link href="/master/financeiro" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-blue-100 hover:bg-white/10 hover:text-white transition-all font-semibold text-lg">
            <span>💰</span> Financeiro
          </Link>
        </nav>

        <div className="p-4 border-t border-white/10">
          <Link href="/acessos" className="flex items-center gap-2 px-4 py-3 text-blue-200 hover:text-white transition-colors font-semibold">
            ← Portal de Acessos
          </Link>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="ml-64 p-8 flex-1">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-4xl font-black text-[#1D3461] mb-2">Eventos</h2>
              <p className="text-gray-500 text-lg font-semibold">Gerencie e configure os eventos da plataforma</p>
            </div>
            <button
              onClick={abrirCriar}
              className="bg-green-600 hover:bg-green-700 text-white font-black px-6 py-3 rounded-2xl transition-all shadow-lg hover:shadow-green-700/20 text-lg flex items-center gap-2"
            >
              <span>➕</span> Novo Evento
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold flex items-center gap-3">
              <span>⚠️</span> {error}
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
                        Mudar Status ({evt.status === 'CONFIGURANDO' ? 'Ativar' : evt.status === 'ATIVO' ? 'Encerrar' : 'Configurar'})
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Criar/Editar Evento */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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
    </div>
  );
}
