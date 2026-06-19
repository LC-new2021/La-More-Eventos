"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegistrationClient({ evento }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatCelular = (value) => {
    const v = value.replace(/\D/g, "");
    if (v.length <= 10) {
      return v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    }
    return v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
  };

  const formatCpf = (value) => {
    const v = value.replace(/\D/g, "");
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!nome.trim() || celular.replace(/\D/g, "").length < 10) {
      setError("Preencha seu nome e um celular válido.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/public/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventoId: evento.id,
          nome,
          celular,
          cpf
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao realizar cadastro.");
      }

      // Redireciona diretamente para o cartão recém-criado
      router.push(`/cartao/${data.codigo}`);
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-[#1D3461] p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/20">
              <span className="text-3xl">🎉</span>
            </div>
            <h2 className="text-sm font-bold text-blue-200 uppercase tracking-widest mb-1">Bem-vindo ao</h2>
            <h1 className="text-2xl font-black text-white">{evento.nome}</h1>
          </div>
        </div>

        {/* Form */}
        <div className="p-8">
          <div className="mb-6 text-center">
            <h3 className="text-xl font-black text-gray-900 mb-2">Seu Cartão Digital</h3>
            <p className="text-sm text-gray-500">
              Preencha os dados abaixo para gerar seu cartão de consumo em segundos e evitar filas!
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-xl text-sm font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                Nome Completo
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3.5 text-gray-900 font-bold focus:bg-white focus:border-[#1D3461] focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                WhatsApp
              </label>
              <input
                type="tel"
                value={celular}
                onChange={(e) => setCelular(formatCelular(e.target.value))}
                placeholder="(00) 00000-0000"
                maxLength={15}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3.5 text-gray-900 font-bold focus:bg-white focus:border-[#1D3461] focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                CPF <span className="text-gray-400 font-normal lowercase">(Opcional)</span>
              </label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3.5 text-gray-900 font-bold focus:bg-white focus:border-[#1D3461] focus:ring-4 focus:ring-blue-50 transition-all outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-[#1D3461] hover:bg-blue-900 text-white font-black py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-70"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Gerar Cartão <span className="text-xl">💳</span>
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400 font-medium">
            Ao gerar seu cartão, você concorda com os termos de uso da plataforma La More.
          </p>
        </div>
      </div>
    </div>
  );
}
