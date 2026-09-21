"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useMensagem } from "../../components/ToastErro";


export default function RedefinirSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useMensagem();
  
  useEffect(() => {
    // Escuta mudanças de sessão para verificar se o usuário veio pelo link de recuperação
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event == "PASSWORD_RECOVERY") {
        console.log("Modo de recuperação de senha detectado.");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagem({ tipo: "", texto: "" });

    if (senha !== confirmarSenha) {
      setMensagem({ tipo: "erro", texto: "As senhas não coincidem." });
      setLoading(false);
      return;
    }

    if (senha.length < 6) {
      setMensagem({ tipo: "erro", texto: "A senha deve ter pelo menos 6 caracteres." });
      setLoading(false);
      return;
    }

    // Atualiza a senha no Supabase
    const { error } = await supabase.auth.updateUser({
      password: senha
    });

    if (error) {
      setMensagem({ tipo: "erro", texto: "Ocorreu um erro ao redefinir sua senha. O link pode ter expirado." });
    } else {
      setMensagem({ tipo: "sucesso", texto: "Senha alterada com sucesso! Redirecionando..." });
      // Remove todas as sessões para o usuário ter que logar de novo por segurança, ou redireciona direto
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8 border-t-4 border-orange-500">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Criar Nova Senha</h1>
          <p className="text-sm text-gray-500">
            Digite sua nova senha de acesso.
          </p>
        </div>

        {mensagem.texto && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium text-center ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nova Senha</label>
            <input 
              type="password" 
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Minimo 6 caracteres" 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-orange-400 outline-none transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmar Nova Senha</label>
            <input 
              type="password" 
              required
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="Digite a senha novamente" 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-orange-400 outline-none transition-all"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold tracking-wide py-3 rounded-xl transition-colors disabled:opacity-70 mt-4"
          >
            {loading ? "Salvando..." : "Redefinir Senha"}
          </button>
        </form>
      </div>
    </main>
  );
}
