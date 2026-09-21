"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useMensagem } from "../../components/ToastErro";


export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useMensagem();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagem({ tipo: "", texto: "" });

    // Envia o email de redefinição usando o Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      setMensagem({ tipo: "erro", texto: "Erro ao enviar e-mail. Verifique se o e-mail está correto." });
    } else {
      setMensagem({ 
        tipo: "sucesso", 
        texto: "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha." 
      });
      setEmail("");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8 border-t-4 border-orange-500">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Recuperar Senha</h1>
          <p className="text-sm text-gray-500">
            Digite seu e-mail cadastrado e enviaremos instruções.
          </p>
        </div>

        {mensagem.texto && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium text-center ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite seu e-mail" 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-orange-400 outline-none transition-all"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold tracking-wide py-3 rounded-xl transition-colors disabled:opacity-70"
          >
            {loading ? "Enviando..." : "Enviar Link"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm font-semibold text-orange-600 hover:text-orange-500 transition-colors">
            Voltar para o Login
          </Link>
        </div>
      </div>
    </main>
  );
}
