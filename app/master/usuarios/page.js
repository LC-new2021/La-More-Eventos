"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MasterUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState('OPERADOR_BAR');
  const [eventoId, setEventoId] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [ie, setIe] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [gatewayActive, setGatewayActive] = useState('ASAAS');
  const [asaasToken, setAsaasToken] = useState('');
  const [asaasUrl, setAsaasUrl] = useState('');
  const [pagbankToken, setPagbankToken] = useState('');
  const [pagbankKey, setPagbankKey] = useState('');
  const [salvando, setSalvando] = useState(false);
  
  // Modal states
  const [mostrarModal, setMostrarModal] = useState(false);
  const [usuarioParaEditar, setUsuarioParaEditar] = useState(null);
 
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
      else setUsuarios(usersData);
 
      if (!eventsData.error) setEventos(eventsData);
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
    setRole('OPERADOR_BAR');
    setEventoId('');
    setRazaoSocial('');
    setCnpj('');
    setIe('');
    setEndereco('');
    setTelefone('');
    setGatewayActive('ASAAS');
    setAsaasToken('');
    setAsaasUrl('');
    setPagbankToken('');
    setPagbankKey('');
    setMostrarModal(true);
  };
 
  const abrirEditar = (user) => {
    setUsuarioParaEditar(user);
    setNome(user.nome || '');
    setEmail(user.email || '');
    setSenha(''); // Leave password empty unless updating
    setRole(user.role || 'OPERADOR_BAR');
    setEventoId(user.eventoId || '');
    setRazaoSocial(user.razaoSocial || '');
    setCnpj(user.cnpj || '');
    setIe(user.ie || '');
    setEndereco(user.endereco || '');
    setTelefone(user.telefone || '');
    setGatewayActive(user.gatewayActive || 'ASAAS');
    setAsaasToken(user.asaasToken || '');
    setAsaasUrl(user.asaasUrl || '');
    setPagbankToken(user.pagbankToken || '');
    setPagbankKey(user.pagbankKey || '');
    setMostrarModal(true);
  };
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setError('');
 
    const url = usuarioParaEditar ? `/api/usuarios/${usuarioParaEditar.id}` : '/api/usuarios';
    const method = usuarioParaEditar ? 'PATCH' : 'POST';
 
    try {
      console.log("Enviando dados de salvamento do usuário:", { nome, email, role, eventoId });
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          ...(senha && { senha }),
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
          pagbankKey
        })
      });
      console.log("Resposta recebida com status:", res.status);
      const result = await res.json();
      console.log("Resultado retornado do JSON:", result);
      
      if (result.error) {
        setError(result.error);
      } else {
        setNome('');
        setEmail('');
        setSenha('');
        setRole('OPERADOR_BAR');
        setEventoId('');
        setRazaoSocial('');
        setCnpj('');
        setIe('');
        setEndereco('');
        setTelefone('');
        setMostrarModal(false);
        setUsuarioParaEditar(null);
        carregarDados();
      }
    } catch (e) {
      console.error("Erro capturado no handleSubmit:", e);
      setError(usuarioParaEditar ? 'Erro ao atualizar usuário' : 'Erro ao criar usuário');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm("ATENÇÃO: Tem certeza que deseja excluir permanentemente este usuário? Esta ação não pode ser desfeita.")) return;
    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) carregarDados();
    } catch (e) {
      console.error('Erro ao excluir usuário', e);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-4xl font-black text-[#1D3461] mb-2">Usuários e Operadores</h2>
          <p className="text-gray-500 text-lg font-semibold">Gerencie os acessos de organizadores, caixas e operadores</p>
        </div>
        <button
          onClick={abrirCriar}
          className="bg-[#1D3461] hover:bg-[#112244] text-white font-black px-6 py-3 rounded-2xl transition-all shadow-lg text-lg flex items-center gap-2"
        >
          <span>➕</span> Novo Usuário
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 p-4 rounded-2xl mb-6 font-bold flex items-center gap-3">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-[#1D3461] text-xl font-bold">Carregando usuários...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-100 text-gray-500 font-bold">
                  <th className="p-6">Nome</th>
                  <th className="p-6">E-mail</th>
                  <th className="p-6">Função</th>
                  <th className="p-6">Evento Vinculado</th>
                  <th className="p-6">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-6 font-bold text-gray-900">{u.nome}</td>
                    <td className="p-6 font-semibold text-gray-500">{u.email}</td>
                    <td className="p-6">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                        u.role === 'MASTER' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'ORGANIZADOR' ? 'bg-blue-100 text-blue-700' :
                        u.role === 'CAIXA' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-6 font-bold text-gray-700">
                      {u.evento?.nome || <span className="text-gray-400 font-semibold">—</span>}
                    </td>
                    <td className="p-6 flex gap-2">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="font-black text-sm px-4 py-2 rounded-xl transition-all border-2 text-gray-700 border-gray-100 hover:bg-gray-50"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleExcluir(u.id)}
                        className="font-black text-sm px-4 py-2 rounded-xl transition-all border-2 text-red-600 border-red-100 hover:bg-red-50"
                      >
                        🗑️ Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Modal Criar/Editar Usuário */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200 scrollbar-thin">
            <h3 className="text-2xl font-black text-[#1D3461] mb-6 flex items-center gap-2 sticky top-0 bg-white pb-2 z-10">
              <span>👥</span> {usuarioParaEditar ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-500 font-bold mb-1 text-sm">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Nome do operador"
                />
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1 text-sm">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  autoComplete="off"
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900 placeholder-gray-400"
                  placeholder="email@lamore.com"
                />
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1 text-sm">
                  Senha {usuarioParaEditar && '(deixe em branco para não alterar)'}
                </label>
                <input
                  type="password"
                  required={!usuarioParaEditar}
                  value={senha}
                  autoComplete="new-password"
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Senha de acesso"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-500 font-bold mb-1 text-sm">Função</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={usuarioParaEditar && usuarioParaEditar.role === 'MASTER'}
                    className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900 disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    <option value="OPERADOR_BAR">Operador de Bar</option>
                    <option value="CAIXA">Operador de Caixa (Sem Dinheiro)</option>
                    <option value="TESOURARIA">Tesouraria (Recebe Dinheiro)</option>
                    <option value="ORGANIZADOR">Produtor</option>
                    <option value="CLIENTE">Cliente Final (Portal)</option>
                    <option value="MASTER">Master Admin</option>
                  </select>
                </div>

                {role !== 'MASTER' && (
                  <div>
                    <label className="block text-gray-500 font-bold mb-1 text-sm">Evento</label>
                    <select
                      value={eventoId}
                      onChange={(e) => setEventoId(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                    >
                      <option value="">Selecione o Evento...</option>
                      {eventos.map(evt => (
                        <option key={evt.id} value={evt.id}>{evt.nome}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {(role === 'ORGANIZADOR' || role === 'CLIENTE') && (
                <div className="border-t border-gray-100 pt-4 mt-4 space-y-4">
                  <p className="font-black text-[#1D3461] text-base flex items-center gap-1.5">🏢 Dados Comerciais / Empresa</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-500 font-bold mb-1 text-sm">Razão Social</label>
                      <input
                        type="text"
                        value={razaoSocial}
                        onChange={(e) => setRazaoSocial(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                        placeholder="Nome da empresa"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 font-bold mb-1 text-sm">CNPJ</label>
                      <input
                        type="text"
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                        placeholder="00.000.000/0001-00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-500 font-bold mb-1 text-sm">Insc. Estadual</label>
                      <input
                        type="text"
                        value={ie}
                        onChange={(e) => setIe(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                        placeholder="IE (Opcional)"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 font-bold mb-1 text-sm">Telefone</label>
                      <input
                        type="text"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-500 font-bold mb-1 text-sm">Endereço Completo</label>
                    <input
                      type="text"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                      placeholder="Rua, Número, Bairro, Cidade - UF"
                    />
                  </div>
                </div>
              )}

              {role === 'ORGANIZADOR' && (
                <div className="border-t border-gray-100 pt-4 mt-4 space-y-4">
                  <p className="font-black text-[#1D3461] text-base flex items-center gap-1.5">🛡️ Configuração de Gateway de Pagamento</p>
                  
                  <div>
                    <label className="block text-gray-500 font-bold mb-1 text-sm">Gateway Ativo</label>
                    <select
                      value={gatewayActive}
                      onChange={(e) => setGatewayActive(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                    >
                      <option value="ASAAS">Asaas API</option>
                      <option value="PAGBANK">PagBank API (Homologação)</option>
                      <option value="NENHUM">Sem Gateway (Somente Dinheiro)</option>
                    </select>
                  </div>

                  {gatewayActive === 'ASAAS' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-gray-500 font-bold mb-1 text-sm">Asaas Token API (ApiKey)</label>
                        <input
                          type="password"
                          value={asaasToken}
                          onChange={(e) => setAsaasToken(e.target.value)}
                          className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                          placeholder="$asaas_api_key_..."
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 font-bold mb-1 text-sm">Asaas API URL (opcional)</label>
                        <input
                          type="text"
                          value={asaasUrl}
                          onChange={(e) => setAsaasUrl(e.target.value)}
                          className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                          placeholder="https://sandbox.asaas.com/api"
                        />
                      </div>
                    </div>
                  )}

                  {gatewayActive === 'PAGBANK' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-gray-500 font-bold mb-1 text-sm">PagBank Client Token</label>
                        <input
                          type="password"
                          value={pagbankToken}
                          onChange={(e) => setPagbankToken(e.target.value)}
                          className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                          placeholder="Token de acesso PagBank"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 font-bold mb-1 text-sm">PagBank Cryptographic Key</label>
                        <input
                          type="password"
                          value={pagbankKey}
                          onChange={(e) => setPagbankKey(e.target.value)}
                          className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#1D3461] focus:bg-white outline-none rounded-2xl px-4 py-3 font-semibold transition-all text-gray-900"
                          placeholder="Chave criptográfica PagBank"
                        />
                      </div>
                    </div>
                  )}
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
