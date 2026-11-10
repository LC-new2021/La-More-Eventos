"use client";

import { useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("activeEventoId");
    }
  }, []);

  async function handleSubmit(e) {
    if (typeof window !== "undefined") { localStorage.removeItem("activeEventoId"); }
    e.preventDefault();
    setErro("");
    setCarregando(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanSenha = senha.trim();

    // Limpa qualquer sessão residual ativa no navegador antes de autenticar o novo usuário
    try {
      await signOut({ redirect: false });
    } catch {}

    let res = null;
    try {
      res = await signIn("credentials", {
        email: cleanEmail,
        password: cleanSenha,
        redirect: false,
      });
    } catch (err) {
      console.error("Erro no signIn:", err);
    }

    if (res?.error) {
      setErro("Email ou senha incorretos.");
      setCarregando(false);
      return;
    }

    // Busca o destino exato e infalível com base no e-mail do usuário autenticado
    try {
      const destRes = await fetch("/api/auth/destino", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const destData = await destRes.json();
      const destino = destData?.destino || "/acessos";

      // Redirecionamento completo para carregar a nova sessão sem resíduos de cache
      window.location.replace(destino);
    } catch {
      window.location.replace("/acessos");
    }
  }

  return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl mb-4 shadow-xl overflow-hidden p-1">
            <img src="/logo.png?v=3" alt="La More Automação Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">La More</h1>
          <p className="text-blue-300 text-base sm:text-lg font-semibold mt-1">Sistema de Eventos</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-blue-200 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full bg-white/10 border-2 border-white/20 text-white placeholder-blue-300/50 rounded-2xl px-5 py-4 text-base sm:text-lg font-semibold focus:outline-none focus:border-white transition-all"
            />
          </div>

          <div>
            <label className="block text-blue-200 text-sm font-bold mb-2">
              Senha
            </label>
            <div className="relative">
              <input
                type={verSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-white/10 border-2 border-white/20 text-white placeholder-blue-300/50 rounded-2xl pl-5 pr-12 py-4 text-base sm:text-lg font-semibold focus:outline-none focus:border-white transition-all"
              />
              <button
                type="button"
                onClick={() => setVerSenha(!verSenha)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-blue-200 hover:text-white transition-colors cursor-pointer select-none"
                title={verSenha ? "Ocultar senha" : "Ver senha"}
              >
                {verSenha ? "🙈" : "🔍"}
              </button>
            </div>
          </div>

          {erro && (
            <div className="bg-red-500/20 border-2 border-red-400/40 rounded-2xl p-4 text-red-200 font-bold text-center text-sm sm:text-base">
              ❌ {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-white text-[#1D3461] font-black text-lg sm:text-xl py-4 sm:py-5 rounded-2xl shadow-2xl hover:bg-blue-50 transition-all disabled:opacity-60 mt-2 cursor-pointer"
            style={{ minHeight: "56px" }}
          >
            {carregando ? "Entrando..." : "Entrar →"}
          </button>
        </form>
      </div>
    </div>
  );
}
