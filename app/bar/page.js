"use client";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

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

  const eventoId = session?.user?.eventoId;
  const [evento, setEvento] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  useEffect(() => {
    if (eventoId) {
      carregarProdutos();
      carregarEvento();
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

  async function carregarProdutos() {
    try {
      const res = await fetch(`/api/produtos?eventoId=${eventoId}`);
      const data = await res.json();
      setProdutos(data);
      const gs = [...new Set(data.map(p => p.grupo))];
      setGrupos(gs);
      if (gs.length) setGrupoSel(gs[0]);
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
      setErro("Acesso à câmera bloqueado. O navegador exige uma conexão segura HTTPS para ativar a câmera em celulares. Use a opção 'Tirar Foto / Galeria' abaixo, ou acesse com HTTPS.");
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
      setErro("Câmera não disponível: " + msg + ". Recomendamos usar a opção 'Tirar Foto / Galeria' abaixo.");
      setScannerAtivo(false);
    }
  }

  async function pararScanner() {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch {}
      html5QrRef.current = null;
    }
  }

  async function lerImagemQR(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCarregando(true);
    setErro("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const tempId = "temp-qr-reader";
      let tempEl = document.getElementById(tempId);
      if (!tempEl) {
        tempEl = document.createElement("div");
        tempEl.id = tempId;
        tempEl.style.display = "none";
        document.body.appendChild(tempEl);
      }
      const scanner = new Html5Qrcode(tempId);
      const texto = await scanner.scanFile(file, false);
      processarQR(texto);
    } catch (err) {
      console.error(err);
      setErro("Não foi possível detectar um QR Code na imagem. Certifique-se de tirar a foto bem próxima e com boa iluminação.");
    } finally {
      setCarregando(false);
    }
  }

  async function processarQR(texto) {
    // Extrair código do URL ou usar o texto direto
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
      const res = await fetch("/api/debitos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: cartao.codigo, produtoId: produtoSel.id, quantidade }),
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

  if (status === "loading") return <div className="min-h-screen bg-[#1D3461] flex items-center justify-center"><p className="text-white text-2xl">Carregando...</p></div>;

  // ── Resultado (Sucesso/Erro) ──
  if (etapa === "resultado") return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${resultado?.ok ? "bg-green-500" : "bg-red-500"}`}>
      <div className="text-center">
        <div className="text-9xl mb-6">{resultado?.ok ? "✅" : "❌"}</div>
        <h1 className="text-5xl font-black text-white mb-3">{resultado?.ok ? "LIBERADO!" : "RECUSADO"}</h1>
        <p className="text-3xl text-white/90 font-bold mb-2">{cartao?.cliente?.nome}</p>
        <p className="text-2xl text-white/80 font-semibold mb-4">{resultado?.produto || resultado?.motivo}</p>
        {resultado?.ok && (
          <div className="bg-white/20 rounded-3xl px-8 py-4 inline-block">
            <p className="text-white font-black text-3xl">- R$ {produtoSel?.preco.toFixed(2).replace(".",",")}</p>
            <p className="text-white/80 font-bold mt-1">Saldo: R$ {resultado?.saldoAtual?.toFixed(2).replace(".",",")}</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── Confirmar Débito ──
  if (etapa === "confirmar" && produtoSel) {
    const totalDebito = produtoSel.preco * quantidade;
    const saldoInsuficiente = cartao?.saldo < totalDebito;

    return (
      <div className="min-h-screen bg-[#1D3461] flex flex-col p-6">
        <button onClick={() => setEtapa("produtos")} className="text-blue-200 text-xl font-bold mb-8">← Voltar</button>
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-blue-200 text-xl font-bold mb-2">Confirmar débito para</p>
          <h2 className="text-4xl font-black text-white mb-1">{cartao?.cliente?.nome}</h2>
          <p className="text-blue-200 text-xl mb-8">Saldo: <span className="text-white font-black">R$ {cartao?.saldo?.toFixed(2).replace(".",",")}</span></p>
          
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center mb-8">
            <p className="text-gray-500 text-xl font-bold mb-2">{produtoSel.grupo}</p>
            <h3 className="text-3xl font-black text-gray-900 mb-2">{produtoSel.nome}</h3>
            <p className="text-xl font-bold text-gray-500 mb-4">Unidade: R$ {produtoSel.preco.toFixed(2).replace(".",",")}</p>
            
            {/* Seletor de Quantidade */}
            <div className="flex items-center justify-center gap-6 mb-6">
              <button 
                onClick={() => setQuantidade(prev => Math.max(1, prev - 1))}
                className="w-12 h-12 rounded-full border-2 border-gray-300 text-gray-700 font-black text-2xl hover:bg-gray-100 transition-colors flex items-center justify-center"
                style={{minWidth: "48px", minHeight: "48px"}}
              >
                -
              </button>
              <span className="text-4xl font-black text-gray-900 w-16">{quantidade}</span>
              <button 
                onClick={() => setQuantidade(prev => prev + 1)}
                className="w-12 h-12 rounded-full border-2 border-gray-300 text-gray-700 font-black text-2xl hover:bg-gray-100 transition-colors flex items-center justify-center"
                style={{minWidth: "48px", minHeight: "48px"}}
              >
                +
              </button>
            </div>

            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total a Debitar</p>
            <p className="text-5xl font-black text-[#1D3461]">R$ {totalDebito.toFixed(2).replace(".",",")}</p>
            {saldoInsuficiente && <p className="text-red-500 font-bold mt-3">⚠️ Saldo insuficiente</p>}
          </div>

          {erro && <p className="text-red-300 font-bold mb-4">{erro}</p>}
          <button onClick={confirmarDebito} disabled={carregando || saldoInsuficiente}
            className="w-full max-w-sm bg-green-500 text-white font-black text-2xl py-6 rounded-3xl shadow-2xl disabled:opacity-40" style={{minHeight:"72px"}}>
            {carregando ? "Processando..." : "✅ CONFIRMAR E ENTREGAR"}
          </button>
        </div>
      </div>
    );
  }

  // ── Produtos ──
  if (etapa === "produtos") return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col">
      <div className="p-5 bg-[#152849] flex items-center justify-between">
        <div>
          <p className="text-blue-300 text-sm font-bold uppercase tracking-widest">Operador de Bar</p>
          <h1 className="text-2xl font-black text-white">{cartao?.cliente?.nome}</h1>
          <p className="text-green-400 font-black text-xl">R$ {cartao?.saldo?.toFixed(2).replace(".",",")}</p>
        </div>
        <button onClick={() => { setCartao(null); setEtapa("scanner"); setScannerAtivo(false); }} className="text-blue-300 font-bold">← Novo QR</button>
      </div>
      <div className="flex gap-3 px-4 mt-4 overflow-x-auto pb-2">
        {grupos.map(g => (
          <button key={g} onClick={() => setGrupoSel(g)} className={`px-5 py-3 rounded-2xl font-black text-lg whitespace-nowrap ${grupoSel===g?"bg-white text-[#1D3461]":"bg-white/10 text-white"}`} style={{minHeight:"52px"}}>{g}</button>
        ))}
      </div>
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {produtosFiltrados.map(p => (
          <button key={p.id} onClick={() => { setProdutoSel(p); setQuantidade(1); setEtapa("confirmar"); }}
            className="w-full bg-white rounded-3xl p-5 flex items-center justify-between shadow-sm" style={{minHeight:"72px"}}>
            <span className="text-xl font-black text-gray-900">{p.nome}</span>
            <span className="text-2xl font-black text-[#1D3461]">R$ {p.preco.toFixed(2).replace(".",",")}</span>
          </button>
        ))}
        {produtosFiltrados.length === 0 && <p className="text-blue-300 text-center mt-8">Nenhum produto neste grupo</p>}
      </div>
    </div>
  );

  // ── Scanner ──
  return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col">
      <div className="p-5 bg-[#152849] flex items-center justify-between">
        <div>
          <p className="text-blue-300 text-sm font-bold uppercase tracking-widest">Operador de Bar</p>
          <h1 className="text-2xl font-black text-white">{evento?.nome || "La More Eventos"}</h1>
        </div>
        <button 
          onClick={async () => {
            await signOut({ redirect: false });
            window.location.href = "/login";
          }} 
          className="text-blue-300 text-sm font-bold cursor-pointer"
        >
          Sair
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
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
            <div id="qr-reader" ref={scannerRef} className="w-full max-w-[280px] aspect-square rounded-3xl overflow-hidden mb-6 bg-black" />
            <p className="text-white text-xl font-bold mb-4">Aponte para o QR Code do cliente</p>
            {carregando && <p className="text-blue-200">Verificando cartão...</p>}
            {erro && <p className="text-red-300 font-bold mb-4">{erro}</p>}
            <button onClick={() => { pararScanner(); setScannerAtivo(false); }} className="bg-white/10 text-white font-bold px-8 py-4 rounded-2xl border-2 border-white/20">Cancelar</button>
          </>
        ) : (
          <>
            <div className="relative w-72 h-72 mb-8">
              <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-2xl" />
              <div className="absolute inset-0 flex items-center justify-center"><span className="text-8xl opacity-20">📷</span></div>
            </div>
            <p className="text-white text-2xl font-bold mb-2">Escanear QR Code</p>
            <p className="text-blue-300 text-lg mb-8">do cartão do cliente</p>
            {erro && <p className="text-red-300 font-bold mb-4 text-center">{erro}</p>}
            {carregando && <p className="text-blue-200 text-lg font-bold mb-4">Processando imagem...</p>}
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button onClick={() => { setErro(""); setScannerAtivo(true); }}
                className="w-full bg-white text-[#1D3461] font-black text-xl py-5 rounded-3xl shadow-xl flex items-center justify-center gap-2" style={{minHeight:"52px"}}>
                📷 Ativar Câmera
              </button>
              <label className="w-full bg-white/10 text-white font-black text-lg py-4 rounded-3xl border-2 border-white/20 hover:bg-white/20 transition-all cursor-pointer flex items-center justify-center gap-2" style={{minHeight:"52px"}}>
                <span>🖼️</span> Tirar Foto / Galeria
                <input type="file" accept="image/*" capture="environment" onChange={lerImagemQR} className="hidden" />
              </label>
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
                  className="flex-1 bg-white/10 border-2 border-white/20 text-white placeholder-blue-300/50 rounded-2xl px-4 py-3 font-semibold focus:outline-none focus:border-white transition-all uppercase"
                />
                <button type="submit" className="bg-white text-[#1D3461] font-black px-5 rounded-2xl hover:bg-blue-50 transition-colors">
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
