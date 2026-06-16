"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  
  const [config, setConfig] = useState({
    gatewayActive: 'ASAAS',
    asaasToken: '',
    asaasUrl: 'https://api.asaas.com',
    mercadoPagoPublicKey: '',
    mercadoPagoAccessToken: '',
    pagbankToken: ''
  });

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      const res = await fetch('/api/org/configuracoes');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar configurações');
      }
      
      if (data.evento) {
        setConfig({
          gatewayActive: data.evento.gatewayActive || 'ASAAS',
          asaasToken: data.evento.asaasToken || '',
          asaasUrl: data.evento.asaasUrl || 'https://api.asaas.com',
          mercadoPagoPublicKey: data.evento.mercadoPagoPublicKey || '',
          mercadoPagoAccessToken: data.evento.mercadoPagoAccessToken || '',
          pagbankToken: data.evento.pagbankToken || ''
        });
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    setSucesso('');

    try {
      const res = await fetch('/api/org/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar configurações');
      }
      
      setSucesso('Configurações de pagamento atualizadas com sucesso!');
      
      // Limpa mensagem de sucesso após 5 segundos
      setTimeout(() => setSucesso(''), 5000);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configurações Financeiras</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vincule sua conta do Asaas ou Mercado Pago para receber o valor das recargas e vendas diretamente na sua conta.
        </p>
      </div>

      {erro && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
          <p className="font-medium">Erro</p>
          <p className="text-sm">{erro}</p>
        </div>
      )}

      {sucesso && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-md">
          <p className="font-medium">Sucesso!</p>
          <p className="text-sm">{sucesso}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Escolha do Gateway */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Gateway de Pagamento Principal</h2>
          
          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="radio"
                name="gatewayActive"
                value="ASAAS"
                checked={config.gatewayActive === 'ASAAS'}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700 font-medium">Asaas</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="radio"
                name="gatewayActive"
                value="MERCADO_PAGO"
                checked={config.gatewayActive === 'MERCADO_PAGO'}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700 font-medium">Mercado Pago</span>
            </label>

            <label className="flex items-center">
              <input
                type="radio"
                name="gatewayActive"
                value="PAGBANK"
                checked={config.gatewayActive === 'PAGBANK'}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700 font-medium">PagBank</span>
            </label>
          </div>
        </div>

        {/* Configurações Asaas */}
        {config.gatewayActive === 'ASAAS' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Credenciais Asaas</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Ativo
              </span>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">API Key (Token de Acesso)</label>
                <input
                  type="password"
                  name="asaasToken"
                  value={config.asaasToken}
                  onChange={handleChange}
                  placeholder="$aact_prod_..."
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">A chave de API gerada no seu painel do Asaas.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Ambiente (URL da API)</label>
                <select
                  name="asaasUrl"
                  value={config.asaasUrl}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="https://api.asaas.com">Produção (api.asaas.com)</option>
                  <option value="https://sandbox.asaas.com/api">Teste / Sandbox (sandbox.asaas.com)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Configurações Mercado Pago */}
        {config.gatewayActive === 'MERCADO_PAGO' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Credenciais Mercado Pago</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Ativo
              </span>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Public Key (Chave Pública)</label>
                <input
                  type="text"
                  name="mercadoPagoPublicKey"
                  value={config.mercadoPagoPublicKey}
                  onChange={handleChange}
                  placeholder="APP_USR-..."
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Usada para iniciar o checkout na tela do cliente.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Access Token (Token de Acesso Privado)</label>
                <input
                  type="password"
                  name="mercadoPagoAccessToken"
                  value={config.mercadoPagoAccessToken}
                  onChange={handleChange}
                  placeholder="APP_USR-..."
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Usado pelo nosso servidor para confirmar e aprovar transações.</p>
              </div>
            </div>
          </div>
        )}

        {/* Configurações PagBank */}
        {config.gatewayActive === 'PAGBANK' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Credenciais PagBank</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Ativo
              </span>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Token de Autenticação (Access Token)</label>
                <input
                  type="password"
                  name="pagbankToken"
                  value={config.pagbankToken}
                  onChange={handleChange}
                  placeholder="Seu token gerado no painel do PagBank..."
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Usado para autorizar transações via Pix na sua conta.</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={salvando}
            className={`inline-flex justify-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${salvando ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {salvando ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>
    </div>
  );
}
