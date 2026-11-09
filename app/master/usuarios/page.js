"use client";
import { useEffect, useState } from 'react';

export default function MasterUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [role, setRole] = useState('OPERADOR_BAR');
  const [eventoId, setEventoId] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [ie, setIe] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [gatewayActive, setGatewayActive] = useState('NENHUM');
  const [asaasToken, setAsaasToken] = useState('');
  const [asaasUrl, setAsaasUrl] = useState('');
  const [pagbankToken, setPagbankToken] = useState('');
  const [pagbankKey, setPagbankKey] = useState('');
  const [stoneToken, setStoneToken] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Modal states
  const [mostrarModal, setMostrarModal] = useState(false);
  const [usuarioParaEditar, setUsuarioParaEditar] = useState(null);

  // Filtros
  const [filtroEvento, setFiltroEvento] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('ativos'); // ativos | desativados | todos
  const [busca, setBusca] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [resUsers, resEvents] = await Promise.all([
        fetch('/api/usuarios'),
        fetch('/api/eventos')
      ]);
      const usersData = await resUsers.json();
      const eventsData = await resEvents.json();

      if (usersData.error) setError(usersData.error);
      else setUsuarios(Array.isArray(usersData) ? usersData : []);

      if (!eventsData.error) setEventos(Array.isArray(eventsData) ? eventsData : []);
    } catch (e) {
      setError('Erro ao carregar dados do banco');
    } finally {
      setLoading(false);
    }
  };

  const abrirCriar = () => {
    setUsuarioParaEditar(null);
    setNome('');
    setEmail('');
    setSenha('');
    setMostrarSenha(false);
    setRole('OPERADOR_BAR');
    setEventoId(filtroEvento || '');
    setRazaoSocial('');
    setCnpj('');
    setIe('');
    setEndereco('');
    setTelefone('');
    setGatewayActive('NENHUM');
    setAsaasToken('');
    setAsaasUrl('');
    setPagbankToken('');
    setPagbankKey('');
    setStoneToken('');
    setMostrarModal(true);
  };

  const abrirEditar = (user) => {
    setUsuarioParaEditar(user);
    setNome(user.nome || '');
    setEmail(user.email || '');
    setSenha('');
    setMostrarSenha(false);
    let userRole = user.role || 'OPERADOR_BAR';
    if (userRole === 'CLIENTE' || userRole === 'SUPORTE') userRole = 'SUPORTE_OPERACIONAL';
    setRole(userRole);
    setEventoId(user.eventoId || '');
    setRazaoSocial(user.razaoSocial || '');
    setCnpj(user.cnpj || '');
    setIe(user.ie || '');
    setEndereco(user.endereco || '');
    setTelefone(user.telefone || '');
    setGatewayActive(user.gatewayActive || 'NENHUM');
    setAsaasToken(user.asaasToken || '');
    setAsaasUrl(user.asaasUrl || '');
    setPagbankToken(user.pagbankToken || '');
    setPagbankKey(user.pagbankKey || '');
    setStoneToken(user.stoneToken || '');
    setMostrarModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const msgConfirm = usuarioParaEditar
      ? `Você quer realmente confirmar as alterações no usuário "${nome.trim()}"?`
      : `Você quer realmente incluir o usuário "${nome.trim()}" (${role}) no sistema?`;

    if (role !== 'MASTER' && !eventoId) {
      alert('⚠️ Por favor, selecione obrigatoriamente o Evento Vinculado para este usuário.');
      return;
    }

    if (!window.confirm(msgConfirm)) return;

    setSalvando(true);
    setError('');

    const payload = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      role,
      eventoId: role === 'MASTER' ? null : (eventoId || null),
      razaoSocial,
      cnpj,
      ie,
      endereco,
      telefone,
      gatewayActive,
      asaasToken,
      asaasUrl,
      pagbankToken,
      pagbankKey,
      stoneToken
    };

    if (senha) {
      payload.senha = senha.trim();
    }

    const url = usuarioParaEditar ? `/api/usuarios/${usuarioParaEditar.id}` : '/api/usuarios';
    const method = usuarioParaEditar ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setMostrarModal(false);
        carregarDados();
      } else {
        setError(data.error || 'Erro ao salvar usuário');
      }
    } catch (e) {
      setError('Erro de conexão ao salvar usuário');
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivoUsuario = async (user) => {
    const novoStatus = user.ativo === false ? true : false;
    const acaoTexto = novoStatus
      ? `Você quer realmente REATIVAR o acesso do usuário "${user.nome}"?`
      : `Você quer realmente DESATIVAR o acesso do usuário "${user.nome}"?\n\nEle não conseguirá fazer login até ser reativado, mas todo o histórico e dados permanecerão salvos na aba Desativados.`;

    if (!window.confirm(acaoTexto)) return;

    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoStatus })
      });
      if (res.ok) {
        carregarDados();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao alterar status do usuário');
      }
    } catch (e) {
      alert('Erro de conexão ao alterar status do usuário');
    }
  };

  const handleExcluir = async (user) => {
    const confirmacao = window.confirm(
      `PERGUNTA FINAL DE CONFIRMAÇÃO:\n\nVocê quer realmente EXCLUIR permanentemente o usuário "${user.nome}" (${user.email})?\n\nSe você só deseja pausar o acesso temporariamente, use a opção "Desativar" para mantê-lo na aba Desativados.\n\nDeseja realmente excluir em definitivo?`
    );
    if (!confirmacao) return;

    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        carregarDados();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir usuário');
      }
    } catch (e) {
      alert('Erro de conexão ao excluir usuário');
    }
  };

  // Filtragem
  const usuariosPorEvento = usuarios.filter((u) => {
    if (filtroEvento && u.eventoId !== filtroEvento && u.role !== 'MASTER') return false;
    return true;
  });

  const totalAtivos = usuariosPorEvento.filter((u) => u.ativo !== false).length;
  const totalDesativados = usuariosPorEvento.filter((u) => u.ativo === false).length;

  const usuariosFiltrados = usuariosPorEvento
    .filter((u) => {
      if (statusFiltro === 'ativos') return u.ativo !== false;
      if (statusFiltro === 'desativados') return u.ativo === false;
      return true;
    })
    .filter((u) => {
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const nomeMatch = u.nome?.toLowerCase().includes(q);
        const emailMatch = u.email?.toLowerCase().includes(q);
        const roleMatch = u.role?.toLowerCase().includes(q);
        const eventoMatch = u.evento?.nome?.toLowerCase().includes(q);
        if (!nomeMatch && !emailMatch && !roleMatch && !eventoMatch) return false;
      }
      return true;
    });

  const getRoleBadge = (roleStr) => {
    if (roleStr === 'MASTER') return { label: 'Master', cor: 'bg-purple-100 text-purple-700' };
    if (roleStr === 'ORGANIZADOR') return { label: 'Organizador', cor: 'bg-blue-100 text-blue-700' };
    if (roleStr === 'SUPORTE_OPERACIONAL' || roleStr === 'CLIENTE' || roleStr === 'SUPORTE')
      return { label: 'Suporte Operacional', cor: 'bg-teal-100 text-teal-700' };
    if (roleStr === 'TESOURARIA') return { label: 'Tesouraria', cor: 'bg-purple-100 text-purple-700' };
    if (roleStr === 'CAIXA' || roleStr === 'CAIXA_VOLANTE') return { label: 'Caixa', cor: 'bg-yellow-100 text-yellow-700' };
    if (roleStr === 'OPERADOR_BAR') return { label: 'Bar', cor: 'bg-green-100 text-green-700' };
    return { label: roleStr?.replace('_', ' ') || 'Outro', cor: 'bg-gray-100 text-gray-700' };
  };

  return (
    <div className="w-full mx-auto">
      {/* TÍTULO E BOTÃO NOVO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1D3461]">Usuários do Sistema</h2>
          <p className="text-gray-500 text-xs sm:text-sm font-semibold">
            {totalAtivos} ativos · {totalDesativados} desativados · {usuariosPorEvento.length} no total
          </p>
        </div>
        <button
          onClick={abrirCriar}
          className="bg-[#1D3461] hover:bg-[#112244] text-white font-bold px-4 py-2 rounded-xl transition-all shadow-md text-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <span>➕</span> Novo Usuário
        </button>
      </div>

      {/* BARRA DE FILTROS: EVENTO, BUSCA E STATUS */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-sm mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Filtrar por Evento</label>
            <select
              value={filtroEvento}
              onChange={(e) => setFiltroEvento(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-[#1D3461] rounded-xl px-3 py-1.5 font-bold text-xs text-[#1D3461] outline-none transition-all cursor-pointer"
            >
              <option value="">🎪 Todos os Eventos ({usuarios.length})</option>
              {eventos.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.nome} ({usuarios.filter(u => u.eventoId === ev.id).length})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Buscar por Nome / Email / Função</label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="🔍 Buscar organizador, suporte ou operador..."
              className="w-full bg-gray-50 border border-gray-200 focus:border-[#1D3461] rounded-xl px-3 py-1.5 font-semibold text-xs text-gray-900 outline-none transition-all"
            />
          </div>
        </div>

        {/* ABAS DE STATUS */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
          <button
            onClick={() => setStatusFiltro('ativos')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFiltro === 'ativos'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>✅ Ativos</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFiltro === 'ativos' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-800'
            }`}>
              {totalAtivos}
            </span>
          </button>

          <button
            onClick={() => setStatusFiltro('desativados')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFiltro === 'desativados'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>⏸️ Desativados</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFiltro === 'desativados' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {totalDesativados}
            </span>
          </button>

          <button
            onClick={() => setStatusFiltro('todos')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFiltro === 'todos'
                ? 'bg-[#1D3461] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>📋 Todos</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFiltro === 'todos' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {usuariosPorEvento.length}
            </span>
          </button>
        </div>
      </div>

      {statusFiltro === 'desativados' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2.5">
          <span className="text-xl">⏸️</span>
          <div>
            <p className="font-bold text-amber-900 text-xs sm:text-sm">
              Ambiente de Usuários e Operadores Desativados
            </p>
            <p className="text-amber-800 text-[11px] sm:text-xs font-medium mt-0.5">
              Estes usuários estão com login pausado. Clique em <strong>&ldquo;✅ Reativar&rdquo;</strong> para restaurar o acesso imediatamente.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-3 rounded-xl mb-4 font-bold text-xs flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">
          <p className="text-[#1D3461] text-base font-bold">Carregando usuários...</p>
        </div>
      ) : usuariosFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 font-bold text-sm">
          {statusFiltro === 'desativados'
            ? 'Nenhum usuário ou operador desativado no momento.'
            : 'Nenhum usuário encontrado com os filtros selecionados.'}
        </div>
      ) : (
        <>
          {/* TABELA OTIMIZADA PARA DESKTOP E LAPTOPS (100% VISÍVEL SEM SCROLL HORIZONTAL) */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-[25%]">Usuário / Criador</th>
                  <th className="py-2.5 px-3 w-[23%]">E-mail</th>
                  <th className="py-2.5 px-3 w-[15%]">Função</th>
                  <th className="py-2.5 px-3 w-[10%]">Status</th>
                  <th className="py-2.5 px-3 w-[13%]">Evento</th>
                  <th className="py-2.5 px-3 w-[14%] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {usuariosFiltrados.map((u) => {
                  const badge = getRoleBadge(u.role);
                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors ${
                        u.ativo !== false ? 'hover:bg-gray-50/60' : 'bg-amber-50/30 hover:bg-amber-50/60'
                      }`}
                    >
                      <td className="py-2 px-3">
                        <p className="font-bold text-gray-900 truncate" title={u.nome}>
                          {u.nome}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate" title={`Criado por: ${u.criadoPorNome || 'Sistema'}`}>
                          por {u.criadoPorNome || 'Sistema'}
                        </p>
                      </td>
                      <td className="py-2 px-3 font-mono text-gray-600 truncate" title={u.email}>
                        {u.email}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-block truncate max-w-full ${badge.cor}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase inline-block ${
                            u.ativo !== false
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {u.ativo !== false ? 'Ativo' : 'Pausado'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-700 truncate font-medium" title={u.evento?.nome || 'Sem evento vinculado'}>
                        {u.evento?.nome || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => toggleAtivoUsuario(u)}
                            className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                              u.ativo !== false
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                            title={u.ativo !== false ? 'Desativar usuário' : 'Reativar usuário'}
                          >
                            {u.ativo !== false ? '⏸️' : '✅'}
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEditar(u)}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg transition-all border border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer whitespace-nowrap shrink-0"
                            title="Editar usuário"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluir(u)}
                            className="text-[11px] font-bold px-1.5 py-1 rounded-lg transition-all border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer whitespace-nowrap shrink-0"
                            title="Excluir usuário"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* CARDS OTIMIZADOS PARA MOBILE E TABLETS PEQUENOS */}
          <div className="block md:hidden space-y-2.5">
            {usuariosFiltrados.map((u) => {
              const badge = getRoleBadge(u.role);
              return (
                <div
                  key={u.id}
                  className={`bg-white rounded-xl border p-3 shadow-sm transition-all ${
                    u.ativo !== false ? 'border-gray-200' : 'border-amber-300 bg-amber-50/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{u.nome}</p>
                      <p className="font-mono text-gray-500 text-xs truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${badge.cor}`}>
                        {badge.label}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                          u.ativo !== false ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {u.ativo !== false ? 'Ativo' : 'Pausado'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium mb-2.5 pt-1 border-t border-gray-100">
                    <span className="truncate max-w-[60%]">🎪 {u.evento?.nome || 'Sem evento vinculado'}</span>
                    <span className="truncate max-w-[40%] text-right text-gray-400">por {u.criadoPorNome || 'Sistema'}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => toggleAtivoUsuario(u)}
                      className={`text-xs font-bold py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                        u.ativo !== false
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      <span>{u.ativo !== false ? '⏸️' : '✅'}</span>
                      <span>{u.ativo !== false ? 'Desativar' : 'Reativar'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEditar(u)}
                      className="text-xs font-bold py-1.5 px-2 rounded-lg transition-all border border-gray-200 text-gray-700 hover:bg-gray-100 text-center flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>✏️</span> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluir(u)}
                      className="text-xs font-bold py-1.5 px-2 rounded-lg transition-all border border-red-200 text-red-600 hover:bg-red-50 text-center flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>🗑️</span> Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Criar/Editar Usuário */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200 scrollbar-thin">
            <h3 className="text-xl font-black text-[#1D3461] mb-4 flex items-center gap-2 sticky top-0 bg-white pb-2 z-10 border-b border-gray-100">
              <span>👥</span> {usuarioParaEditar ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-gray-500 font-bold mb-1 text-xs">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#1D3461] focus:bg-white outline-none rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 placeholder-gray-400"
                  placeholder="Ex: João da Silva"
                />
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1 text-xs">E-mail (Login de Acesso)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#1D3461] focus:bg-white outline-none rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 placeholder-gray-400"
                  placeholder="Ex: joao@lamore.com"
                />
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1 text-xs">
                  {usuarioParaEditar ? 'Senha (deixe em branco para manter a atual)' : 'Senha de Acesso'}
                </label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    required={!usuarioParaEditar}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#1D3461] focus:bg-white outline-none rounded-xl px-3 py-2 pr-10 text-xs font-semibold text-gray-900 placeholder-gray-400"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-sm cursor-pointer select-none"
                    title={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {mostrarSenha ? '🙈' : '🔍'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-gray-500 font-bold mb-1 text-xs">Função / Perfil</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#1D3461] focus:bg-white outline-none rounded-xl px-2.5 py-2 text-xs font-bold text-gray-900 cursor-pointer"
                  >
                    <option value="OPERADOR_BAR">🍺 Operador de Bar</option>
                    <option value="CAIXA">💳 Caixa Fixo</option>
                    <option value="CAIXA_VOLANTE">📱 Caixa Volante</option>
                    <option value="TESOURARIA">💰 Tesouraria</option>
                    <option value="ORGANIZADOR">🎯 Produtor / Org</option>
                    <option value="SUPORTE_OPERACIONAL">🛠️ Suporte Operacional</option>
                    <option value="MASTER">👑 Administrador Master</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1 text-xs">
                    Evento Vinculado {role !== 'MASTER' && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={eventoId}
                    onChange={(e) => setEventoId(e.target.value)}
                    disabled={role === 'MASTER'}
                    required={role !== 'MASTER'}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#1D3461] focus:bg-white outline-none rounded-xl px-2.5 py-2 text-xs font-semibold text-gray-900 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="">{role === 'MASTER' ? 'Nenhum / Geral (Acesso Global)' : 'Selecione o Evento Vinculado (Obrigatório)...'}</option>
                    {eventos.map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Informações complementares para Produtor/Organizador */}
              {role === 'ORGANIZADOR' && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2 mt-2">
                  <p className="text-[#1D3461] font-black text-xs">Dados de Faturamento do Produtor</p>
                  <div>
                    <label className="block text-gray-500 font-bold text-[10px]">Razão Social / Nome Fantasia</label>
                    <input
                      type="text"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-500 font-bold text-[10px]">CNPJ / CPF</label>
                      <input
                        type="text"
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 font-bold text-[10px]">Telefone</label>
                      <input
                        type="text"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 bg-[#1D3461] hover:bg-[#112244] text-white font-bold py-2.5 rounded-xl transition-all text-xs disabled:opacity-50 cursor-pointer"
                >
                  {salvando ? 'Salvando...' : 'Salvar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
