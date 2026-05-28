"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    const res = await signIn("credentials", {
      email,
      password: senha,
      redirect: false,
    });

    setCarregando(false);

    if (res?.error) {
      setErro("Email ou senha incorretos.");
      return;
    }

    // Buscar sessão para redirecionar pelo role
    const sessao = await fetch("/api/auth/session").then((r) => r.json());
    const role = sessao?.user?.role;

    if (role === "MASTER") router.push("/master");
    else if (role === "ORGANIZADOR") router.push("/org");
    else if (role === "CAIXA") router.push("/pos");
    else if (role === "OPERADOR_BAR") router.push("/bar");
    else router.push("/acessos");
  }

  return (
    <div className="min-h-screen bg-[#1D3461] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl mb-4 shadow-xl overflow-hidden p-1">
            <img src="/logo.png" alt="La More Automação Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-black text-white">La More</h1>
          <p className="text-blue-300 text-lg font-semibold mt-1">Sistema de Eventos</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-blue-200 font-bold text-sm uppercase tracking-widest block mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full bg-white/10 border-2 border-white/20 text-white placeholder-blue-300/50 rounded-2xl px-5 py-4 text-lg font-semibold focus:outline-none focus:border-white transition-all"
            />
          </div>

          <div>
            <label className="text-blue-200 font-bold text-sm uppercase tracking-widest block mb-2">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-white/10 border-2 border-white/20 text-white placeholder-blue-300/50 rounded-2xl px-5 py-4 text-lg font-semibold focus:outline-none focus:border-white transition-all"
            />
          </div>

          {erro && (
            <div className="bg-red-500/20 border-2 border-red-400/40 rounded-2xl p-4 text-red-200 font-bold text-center">
              ❌ {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-white text-[#1D3461] font-black text-xl py-5 rounded-2xl shadow-2xl hover:bg-blue-50 transition-all disabled:opacity-60 mt-2"
            style={{ minHeight: "60px" }}
          >
            {carregando ? "Entrando..." : "Entrar →"}
          </button>
        </form>

        <p className="text-center text-blue-400 text-sm font-medium mt-8">
          La More Eventos © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
