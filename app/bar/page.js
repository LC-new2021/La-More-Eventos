"use client";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

// Componente de Cabeçalho Universal fora do render para conformidade React
function BarHeader({ evento, session, voltarFn = null, tituloExtra = null, onNavegar, onSair }) {
  const role = session?.user?.role;
  const isMaster = role === "MASTER";
  const isSupport = role === "SUPORTE_OPERACIONAL" || role === "CLIENTE" || role === "SUPORTE";
  const canSwitchSectors = isMaster || isSupport;

  return (
    <div className="p-3 sm:p-4 bg-[#152849] border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 sticky top-0 z-20 shadow-md">
      <div className="flex items-center gap-2.5 min-w-0">
        {voltarFn && (
          <button 
            onClick={voltarFn}
            className="text-white font-bold text-xs sm:text-sm bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl border border-white/10 transition-all cursor-pointer shrink-0"
          >
            ← Voltar
          </button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-lg sm:text-xl shrink-0">🍺</span>
            <h1 className="text-sm sm:text-lg font-black text-white leading-tight truncate">
              {evento?.nome || "Operação de Bar"}
            </h1>
          </div>
          <p className="text-blue-300 text-[11px] sm:text-xs font-semibold truncate">
            {session?.user?.nome ? `Operador: ${session.user.nome}` : "Bar"} {tituloExtra ? `• ${tituloExtra}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
        {canSwitchSectors && (
          <>
            <button
              onClick={() => onNavegar(isMaster ? "/master" : "/org")}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-black px-2.5 sm:px-3 py-2 rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              title="Ir para o Painel Principal"
            >
              <span>{isMaster ? "👑" : "🛠️"}</span> <span className="hidden md:inline">{isMaster ? "Master" : "Retaguarda"}</span>
            </button>

            <button
              onClick={() => onNavegar("/pos")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-2.5 sm:px-3 py-2 rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              title="Alternar para o Caixa / Vendas (POS)"
            >
              <span>💳</span> <span className="hidden sm:inline">Caixa</span>
            </button>

            <button
              onClick={() => onNavegar("/acessos")}
              className="bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl border border-white/10 transition-all flex items-center gap-1 cursor-pointer"
              title="Portal de Acessos"
            >
              <span>🏠</span> <span className="hidden md:inline">Acessos</span>
            </button>
          </>
        )}

        <button
          onClick={onSair}
          className="bg-red-600 hover:bg-red-700 text-white text-xs font-black px-3 sm:px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
          title="Sair do sistema e encerrar sessão"
        >
          <span>🚪</span> Sair
        </button>
      </div>
    </div>
  );
}

export default function BarApp() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [etapa, setEtapa] = useState("scanner");
  const [cartao, setCartao] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [grupoSel, setGrupoSel] = useState("");
  const [produtoSel, setProdutoSel] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const [resultado, setResultado] = useState(null); // { ok, saldoAtual, produto }
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [scannerAtivo, setScannerAtivo] = useState(false);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  // Busca de clientes no Bar
  const [buscaAtiva, setBuscaAtiva] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [totalFesta, setTotalFesta] = useState(0);
  const [precoVariavelInput, setPrecoVariavelInput] = useState(""); // para produtos de preco livre

  const [eventoId, setEventoId] = useState(null);
  const [evento, setEvento] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.replace("/login");
    }
  }, [status]);

  useEffect(() => {
    if (session) {
      if (session.user?.eventoId) {
        setEventoId(session.user.eventoId);
      } else {
        const stored = typeof window !== "undefined" ? localStorage.getItem("activeEventoId") : null;
        if (stored) {
          setEventoId(stored);
        } else {
          fetch("/api/eventos")
            .then(r => r.json())
            .then(data => {
              if (Array.isArray(data) && data.length > 0) {
                localStorage.setItem("activeEventoId", data[0].id);
                setEventoId(data[0].id);
              }
            })
            .catch(console.error);
        }
      }
    }
  }, [session]);

  useEffect(() => {
    if (eventoId) {
      carregarProdutos();
      carregarEvento();
      carregarTotalFesta();
    }
  }, [eventoId]);

  async function carregarEvento() {
    try {
      const res = await fetch(`/api/eventos/${eventoId}`);
      const data = await res.json();
      if (!data.error) setEvento(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function carregarTotalFesta() {
    if (!eventoId) return;
    try {
      const res = await fetch(`/api/clientes?eventoId=${eventoId}&q=`);
      const totalHeader = res.headers.get("X-Total-Count");
      if (totalHeader) {
        setTotalFesta(parseInt(totalHeader));
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function buscarClientesNoBar() {
    if (!eventoId) {
      setErro("Nenhum evento ativo para fazer buscas.");
      return;
    }
    setBuscando(true);
    setErro("");
    try {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(termoBusca)}&eventoId=${eventoId}`);
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Erro ao buscar clientes.");
        return;
      }
      setResultadosBusca(data);
      const totalHeader = res.headers.get("X-Total-Count");
      if (totalHeader) {
        setTotalFesta(parseInt(totalHeader));
      }
    } catch {
      setErro("Erro de conexão ao buscar clientes.");
    } finally {
      setBuscando(false);
    }
  }

  async function carregarProdutos() {
    try {
      const res = await fetch(`/api/produtos?eventoId=${eventoId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setProdutos(data);
        const gs = [...new Set(data.map(p => p.grupo))];
        setGrupos(gs);
        if (gs.length) setGrupoSel(gs[0]);
      }
    } catch { setErro("Erro ao carregar produtos"); }
  }

  useEffect(() => {
    let active = true;
    if (etapa === "scanner" && scannerAtivo) {
      const timer = setTimeout(() => {
        if (active) iniciarScanner();
      }, 300);
      return () => {
        active = false;
        clearTimeout(timer);
        pararScanner();
      };
    } else {
      pararScanner();
    }
  }, [etapa, scannerAtivo]);

  async function iniciarScanner() {
    if (!scannerRef.current || html5QrRef.current) return;

    if (typeof window !== "undefined" && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
      setErro("Acesso à câmera bloqueado. O navegador exige uma conexão segura HTTPS para ativar a câmera em celulares. Use a opção de busca ou código abaixo.");
      setScannerAtivo(false);
      return;
    }

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      html5QrRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (texto) => { pararScanner(); processarQR(texto); }
      );
    } catch (e) {
      console.error(e);
      const msg = e?.message || (e && typeof e.toString === "function" ? e.toString() : "Erro de permissão ou câmera ocupada");
      setErro("Câmera não disponível: " + msg);
      setScannerAtivo(false);
    }
  }

  async function pararScanner() {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
      } catch {}
      html5QrRef.current = null;
    }
  }

  // Navegação segura sem atrasos nem travas de câmera
  const navegarPara = async (url) => {
    try {
      await pararScanner();
    } catch {}
    window.location.href = url;
  };

  const sairDoSistema = async () => {
    try {
      await pararScanner();
    } catch {}
    try {
      await signOut({ redirect: false });
    } catch {}
    window.location.replace("/login");
  };

  async function processarQR(texto) {
    let codigo = texto;
    try {
      const url = new URL(texto);
      const partes = url.pathname.split("/");
      codigo = partes[partes.length - 1].toUpperCase();
    } catch { codigo = texto.toUpperCase(); }

    setErro("");
    setCarregando(true);
    try {
      const res = await fetch(`/api/cartao/${codigo}`);
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Cartão inválido"); setCarregando(false); return; }
      setCartao(data);
      setEtapa("produtos");
    } catch { setErro("Erro de conexão"); }
    finally { setCarregando(false); }
  }

  async function confirmarDebito() {
    if (!cartao || !produtoSel) return;
    setCarregando(true);
    setErro("");
    try {
      const precoFinal = produtoSel.precoVariavel && precoVariavelInput ? parseFloat(precoVariavelInput) : produtoSel.preco;
      const body = { codigo: cartao.codigo, produtoId: produtoSel.id, quantidade };
      if (produtoSel.precoVariavel && precoVariavelInput) body.precoCustom = precoFinal;
      const res = await fetch("/api/debitos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setResultado({ ok: false, motivo: data.error, saldoAtual: data.saldo });
      } else {
        setResultado({ ok: true, saldoAtual: data.saldoAtual, produto: quantidade > 1 ? `${quantidade}x ${data.produto}` : data.produto });
        setCartao(prev => ({ ...prev, saldo: data.saldoAtual }));
      }
      setEtapa("resultado");
      setTimeout(() => { setEtapa("scanner"); setProdutoSel(null); setQuantidade(1); setResultado(null); setScannerAtivo(false); }, 3500);
    } catch { setErro("Erro de conexão"); }
    finally { setCarregando(false); }
  }

  const produtosFiltrados = produtos.filter(p => p.grupo === grupoSel && p.ativo);

  if (status === "loading") return <div className="min-h-screen bg-[#1D3461] flex items-center justify-center"><p className="text-white text-2xl font-bold">Carregando...</p></div>;

  // ── Resultado (Sucesso/Erro) ──
  if (etapa === "resultado") return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${resultado?.ok ? "bg-green-500" : "bg-red-500"}`}>
      <div className="text-center">
        <div className="text-8xl sm:text-9xl mb-6">{resultado?.ok ? "✅" : "❌"}</div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-3">{resultado?.ok ? "LIBERADO!" : "RECUSADO"}</h1>
        <p className="text-2xl sm:text-3xl text-white/90 font-bold mb-2">{cartao?.cliente?.nome}</p>
        <p className="text-xl sm:text-2xl text-white/80 font-semibold mb-4">{resultado?.produto || resultado?.motivo}</p>
        {resultado?.ok && (
          <div className="bg-white/20 rounded-3xl px-8 py-4 inline-block">
            <p className="text-white font-black text-2xl sm:text-3xl">- R$ {produtoSel?.preco?.toFixed(2).replace(".",",")}</p>
            <p className="text-white/80 font-bold mt-1">Saldo: R$ {resultado?.saldoAtual?.toFixed(2).replace(".",",")}</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── Confirmar Débito ──
  if (etapa === "confirmar" && produtoSel) {
    const precoUnit = produtoSel.precoVariavel && precoVariavelInput ? parseFloat(precoVariavelInput) || 0 : produtoSel.preco;
    const totalDebito = precoUnit * quantidade;
    const saldoInsuficiente = cartao?.saldo < totalDebito;

    return (
      <div className="min-h-screen bg-[#1D3461] flex flex-col">
        <BarHeader 
          evento={evento} 
          session={session} 
          voltarFn={() => setEtapa("produtos")} 
          tituloExtra="Confirmar Pedido" 
          onNavegar={navegarPara} 
          onSair={sairDoSistema} 
        />
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
          <p className="text-blue-200 text-lg sm:text-xl font-bold mb-1">Confirmar débito para</p>
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-1 text-center">{cartao?.cliente?.nome}</h2>
          <p className="text-blue-200 text-lg sm:text-xl mb-6">Saldo: <span className="text-white font-black">R$ {cartao?.saldo?.toFixed(2).replace(".",",")}</span></p>
          
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center mb-6 shadow-xl">
            <p className="text-gray-500 text-base sm:text-xl font-bold mb-1">{produtoSel.grupo}</p>
            <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">{produtoSel.nome}</h3>
            {produtoSel.observacao && <p className="text-sm text-gray-400 font-semibold mb-3 italic">{produtoSel.observacao}</p>}
            {produtoSel.precoVariavel ? (
              <div className="mb-4">
                <p className="text-sm font-bold text-amber-600 mb-2">💲 Produto de Preço Variável — informe o valor:</p>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={precoVariavelInput}
                  onChange={(e) => setPrecoVariavelInput(e.target.value)}
                  placeholder="R$ 0,00"
                  className="w-full border-2 border-amber-300 rounded-2xl px-4 py-3 text-2xl font-black text-center text-gray-900 focus:outline-none focus:border-amber-500"
                />
              </div>
            ) : (
              <p className="text-lg sm:text-xl font-bold text-gray-500 mb-4">Unidade: R$ {produtoSel.preco.toFixed(2).replace(".",",")}</p>
            )}
            
            {/* Seletor de Quantidade */}
            <div className="flex items-center justify-center gap-6 mb-5">
              <button 
                onClick={() => setQuantidade(prev => Math.max(1, prev - 1))}
                className="w-12 h-12 rounded-full border-2 border-gray-300 text-gray-700 font-black text-2xl hover:bg-gray-100 transition-colors flex items-center justify-center cursor-pointer"
                style={{minWidth: "48px", minHeight: "48px"}}
              >
                -
              </button>
              <span className="text-4xl font-black text-gray-900 w-16">{quantidade}</span>
              <button 
                onClick={() => setQuantidade(prev => prev + 1)}
                className="w-12 h-12 rounded-full border-2 border-gray-300 text-gray-700 font-black text-2xl hover:bg-gray-100 transition-colors flex items-center justify-center cursor-pointer"
                style={{minWidth: "48px", minHeight: "48px"}}
              >
                +
              </button>
            </div>

            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total a Debitar</p>
            <p className="text-4xl sm:text-5xl font-black text-[#1D3461]">R$ {totalDebito.toFixed(2).replace(".",",")}</p>
            {saldoInsuficiente && <p className="text-red-500 font-bold mt-3">⚠️ Saldo insuficiente</p>}
          </div>

          {erro && <p className="text-red-300 font-bold mb-4 text-center">{erro}</p>}
          <button onClick={confirmarDebito} disabled={carregando || saldoInsuficiente}
            className="w-full max-w-sm bg-green-500 hover:bg-green-600 text-white font-black text-xl sm:text-2xl py-5 sm:py-6 rounded-3xl shadow-2xl disabled:opacity-40 cursor-pointer transition-all" style={{minHeight:"68px"}}>
            {carregando ? "Processando..." : "✅ CONFIRMAR E ENTREGAR"}
          </button>
        </div>
      </div>
    );
  }

  // ── Produtos ──
  if (etapa === "produtos") return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col">
      <BarHeader 
        evento={evento} 
        session={session} 
        voltarFn={() => { setCartao(null); setEtapa("scanner"); setScannerAtivo(false); }}
        tituloExtra={cartao?.cliente?.nome ? `Cliente: ${cartao.cliente.nome}` : null}
        onNavegar={navegarPara}
        onSair={sairDoSistema}
      />
      <div className="p-4 bg-[#152849]/60 flex items-center justify-between border-b border-white/5 gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-black text-white truncate">{cartao?.cliente?.nome}</h2>
          <p className="text-green-400 font-black text-base sm:text-lg">Saldo: R$ {cartao?.saldo?.toFixed(2).replace(".",",")}</p>
        </div>
        <button 
          onClick={() => { setCartao(null); setEtapa("scanner"); setScannerAtivo(false); }} 
          className="text-blue-300 hover:text-white font-bold bg-white/10 px-3 py-1.5 rounded-xl cursor-pointer text-xs sm:text-sm shrink-0"
        >
          ← Trocar Cliente
        </button>
      </div>

      <div className="flex gap-2.5 px-4 mt-4 overflow-x-auto pb-2">
        {grupos.map(g => (
          <button key={g} onClick={() => setGrupoSel(g)} className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl font-black text-base sm:text-lg whitespace-nowrap cursor-pointer transition-all ${grupoSel===g?"bg-white text-[#1D3461]":"bg-white/10 text-white hover:bg-white/20"}`} style={{minHeight:"48px"}}>{g}</button>
        ))}
      </div>
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {produtosFiltrados.map(p => (
          <button key={p.id} onClick={() => { setProdutoSel(p); setQuantidade(1); setEtapa("confirmar"); }}
            className="w-full bg-white hover:bg-blue-50 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-3 shadow-sm cursor-pointer transition-all" style={{minHeight:"68px"}}>
            <span className="text-lg sm:text-xl font-black text-gray-900 text-left">{p.nome}</span>
            <span className="text-xl sm:text-2xl font-black text-[#1D3461] shrink-0">R$ {p.preco.toFixed(2).replace(".",",")}</span>
          </button>
        ))}
        {produtosFiltrados.length === 0 && <p className="text-blue-300 text-center mt-8">Nenhum produto neste grupo</p>}
      </div>
    </div>
  );

  // ── Busca de Cliente no Bar ──
  if (buscaAtiva) return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col">
      <BarHeader 
        evento={evento} 
        session={session} 
        voltarFn={() => { setBuscaAtiva(false); setTermoBusca(""); setResultadosBusca([]); }} 
        tituloExtra="Buscar Cliente" 
        onNavegar={navegarPara}
        onSair={sairDoSistema}
      />
      <div className="p-4 sm:p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-5 gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Buscar Cliente</h2>
            <p className="text-blue-200 text-xs sm:text-sm mt-0.5 font-semibold">Pesquise por nome, CPF ou código do cartão</p>
          </div>
          {totalFesta > 0 && (
            <div className="bg-white/10 px-3 sm:px-4 py-2 rounded-2xl text-center border border-white/10 shrink-0">
              <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Cadastrados</p>
              <p className="text-white text-base sm:text-lg font-black">{totalFesta}</p>
            </div>
          )}
        </div>

        {erro && <p className="bg-red-600 text-white p-3 rounded-xl mb-4 font-bold border border-red-500 text-center text-sm">{erro}</p>}
        
        <div className="flex gap-2 mb-5">
          <input 
            value={termoBusca} 
            onChange={e => setTermoBusca(e.target.value)} 
            onKeyDown={e => e.key === "Enter" && buscarClientesNoBar()} 
            placeholder="Nome, CPF ou código..." 
            className="flex-1 min-w-0 bg-white/10 border-2 border-white/20 text-white placeholder-blue-300/50 rounded-2xl px-4 py-3.5 text-base sm:text-lg font-semibold focus:outline-none focus:border-white transition-all uppercase" 
          />
          <button 
            onClick={buscarClientesNoBar} 
            disabled={buscando} 
            className="bg-white text-[#1D3461] font-black px-5 py-3.5 rounded-2xl hover:bg-blue-50 transition-colors flex items-center justify-center cursor-pointer shrink-0"
            style={{ minHeight: "52px" }}
          >
            {buscando ? "..." : "Buscar"}
          </button>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto max-h-[60vh] scrollbar-thin">
          {buscando && <p className="text-blue-200 text-center py-8 font-semibold">Buscando clientes...</p>}
          
          {resultadosBusca.map(c => (
            <div key={c.id} className="bg-white rounded-3xl p-4 sm:p-5 shadow-md flex justify-between items-center gap-3">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-gray-900 truncate">{c.cliente.nome}</h3>
                <p className="text-gray-400 text-xs font-bold uppercase truncate">Cód: {c.codigo} {c.cliente.cpf ? `· CPF: ${c.cliente.cpf}` : ""}</p>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                <span className="text-green-600 font-black text-lg sm:text-xl">R$ {c.saldo.toFixed(2).replace(".",",")}</span>
                <button 
                  onClick={() => {
                    setCartao(c);
                    setBuscaAtiva(false);
                    setEtapa("produtos");
                  }} 
                  className="bg-[#1D3461] hover:bg-blue-900 text-white font-black text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Selecionar
                </button>
              </div>
            </div>
          ))}
          
          {!buscando && resultadosBusca.length === 0 && (
            <p className="text-blue-300 text-center py-12 text-sm sm:text-base">Digite um termo ou clique em Buscar para listar.</p>
          )}
        </div>
      </div>
    </div>
  );

  // ── Scanner (Tela Principal) ──
  return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col">
      <BarHeader 
        evento={evento} 
        session={session} 
        onNavegar={navegarPara}
        onSair={sairDoSistema}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        {scannerAtivo ? (
          <>
            <style dangerouslySetInnerHTML={{__html: `
              #qr-reader video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                border-radius: 24px;
              }
            `}} />
            <div id="qr-reader" ref={scannerRef} className="w-full max-w-[260px] sm:max-w-[280px] aspect-square rounded-3xl overflow-hidden mb-5 bg-black" />
            <p className="text-white text-lg sm:text-xl font-bold mb-4 text-center">Aponte para o QR Code do cliente</p>
            {carregando && <p className="text-blue-200">Verificando cartão...</p>}
            {erro && <p className="text-red-300 font-bold mb-4 text-center text-sm">{erro}</p>}
            <button onClick={() => { pararScanner(); setScannerAtivo(false); }} className="bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-2xl border-2 border-white/20 cursor-pointer">Cancelar Câmera</button>
          </>
        ) : (
          <>
            <div className="relative w-56 h-56 sm:w-72 sm:h-72 mb-6 sm:mb-8">
              <div className="absolute top-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-t-4 border-l-4 border-white rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-t-4 border-r-4 border-white rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-b-4 border-l-4 border-white rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-b-4 border-r-4 border-white rounded-br-2xl" />
              <div className="absolute inset-0 flex items-center justify-center"><span className="text-7xl sm:text-8xl opacity-20">📷</span></div>
            </div>
            <p className="text-white text-xl sm:text-2xl font-bold mb-1">Escanear QR Code</p>
            <p className="text-blue-300 text-base sm:text-lg mb-6 sm:mb-8">do cartão do cliente</p>
            {erro && <p className="text-red-300 font-bold mb-4 text-center text-sm">{erro}</p>}
            {carregando && <p className="text-blue-200 text-lg font-bold mb-4">Processando imagem...</p>}
            <div className="flex flex-col gap-2.5 w-full max-w-xs">
              <button onClick={() => { setErro(""); setScannerAtivo(true); }}
                className="w-full bg-white hover:bg-blue-50 text-[#1D3461] font-black text-lg sm:text-xl py-4 sm:py-5 rounded-3xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all" style={{minHeight:"52px"}}>
                📷 Ativar Câmera
              </button>
              <button onClick={() => { setErro(""); setBuscaAtiva(true); }}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-black text-base sm:text-lg py-4 rounded-3xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md" style={{minHeight:"52px"}}>
                🔍 Buscar por Nome / CPF
              </button>
            </div>

            <div className="w-full max-w-xs mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-3">Ou digite o código do cartão</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const form = e.target;
                const codigoInput = form.elements.codigo.value.trim();
                if (codigoInput) {
                  processarQR(codigoInput);
                  form.reset();
                }
              }} className="flex gap-2">
                <input
                  name="codigo"
                  type="text"
                  placeholder="Ex: LMMPN..."
                  required
                  className="flex-1 min-w-0 bg-white/10 border-2 border-white/20 text-white placeholder-blue-300/50 rounded-2xl px-4 py-3 font-semibold focus:outline-none focus:border-white transition-all uppercase"
                />
                <button type="submit" className="bg-white hover:bg-blue-50 text-[#1D3461] font-black px-5 rounded-2xl transition-colors cursor-pointer shrink-0">
                  Ir →
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
