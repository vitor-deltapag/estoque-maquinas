"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, setRememberMe, setAccessToken, markSessionStarted, REMEMBER_KEY } from "../../lib/supabase";
import { postLogin } from "../../lib/api";
import { useMensagemErro } from "../../components/ToastErro";


export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagemErro, setMensagemErro] = useMensagemErro();
  const [lembrar, setLembrar] = useState(true);

  useEffect(() => {
    setLembrar(window.localStorage.getItem(REMEMBER_KEY) !== "0");
    const params = new URLSearchParams(window.location.search);
    if (params.get("inativo") === "1") {
      setMensagemErro("Sessão encerrada por inatividade.");
    } else if (params.get("expirada") === "1") {
      setMensagemErro("Sessão encerrada após 7 dias. Entre novamente.");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagemErro("");

    try {
      const response = await postLogin(email, senha);

      if (response.status === 429) {
        setMensagemErro("Muitas tentativas de login. Tente novamente em instantes.");
        return;
      }

      if (!response.ok) {
        setMensagemErro("E-mail ou senha incorretos.");
        return;
      }

      const data = await response.json();
      setRememberMe(lembrar);
      const { data: sessionData, error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (error || !sessionData.session) {
        setMensagemErro("E-mail ou senha incorretos.");
        return;
      }

      setAccessToken(sessionData.session.access_token);
      markSessionStarted();
      window.location.assign("/");
    } catch {
      setMensagemErro("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Fundo da página levemente acinzentado para destacar o cartão branco/laranja
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-8 transition-colors">
      
      {/* Container Principal (O Cartão Dividido) */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row transition-colors">
        
        {/* ========================================== */}
        {/* LADO ESQUERDO: FORMULÁRIO (Fundo Laranja)  */}
        {/* ========================================== */}
        <div className="w-full md:w-1/2 bg-orange-500 p-10 sm:p-16 flex flex-col justify-center relative">
          
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-white tracking-widest uppercase mb-2">
              Bem-Vindo
            </h1>
            <p className="text-orange-100 text-sm tracking-wide">ESTOQUE DELTA</p>
          </div>

          {mensagemErro && (
            <div className="mb-6 p-3 bg-white/20 border border-white/40 text-white text-sm rounded-lg font-medium text-center backdrop-blur-sm">
              {mensagemErro}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6" autoComplete="off">
            
            {/* Input E-mail (Estilo Pílula) */}
            <div>
              <input 
                type="email" 
                name="login-email"
                required
                autoComplete="off"
                readOnly
                onFocus={(e) => e.currentTarget.removeAttribute("readOnly")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex.:  nome@empresa.com.br" 
                className="w-full bg-white rounded-full px-6 py-3.5 text-gray-900 font-medium placeholder-gray-400 focus:ring-4 focus:ring-orange-300 outline-none transition-all shadow-inner"
              />
            </div>

            {/* Input Senha (Estilo Pílula) */}
            <div>
              <input 
                type="password" 
                name="login-senha"
                required
                autoComplete="new-password"
                readOnly
                onFocus={(e) => e.currentTarget.removeAttribute("readOnly")}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha" 
                className="w-full bg-white rounded-full px-6 py-3.5 text-gray-900 font-medium placeholder-gray-400 focus:ring-4 focus:ring-orange-300 outline-none transition-all shadow-inner"
              />
            </div>

            {/* Checkbox e Esqueceu a Senha */}
            <div className="flex items-center justify-between px-2 text-sm text-white">
              <label className="flex items-center cursor-pointer">
                <input 
                  type="checkbox"
                  checked={lembrar}
                  onChange={(e) => setLembrar(e.target.checked)}
                  className="mr-2 h-4 w-4 rounded border-white bg-white accent-orange-600 cursor-pointer" 
                />
                Lembrar de mim
              </label>
              <Link href="/esqueci-senha" className="hover:text-orange-200 transition-colors">
                Esqueceu a Senha?
              </Link>
            </div>

            {/* Botão Submit (Branco para contrastar com o fundo laranja) */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-white hover:bg-gray-50 text-orange-600 font-bold tracking-widest uppercase py-4 rounded-full transition-colors shadow-lg disabled:opacity-80 mt-2"
            >
              {loading ? "Autenticando..." : "Entrar"}
            </button>
            
          </form>
        </div>

        {/* ========================================== */}
        {/* LADO DIREITO: ILUSTRAÇÃO (Fundo Branco)    */}
        {/* ========================================== */}
        <div className="w-full md:w-1/2 bg-white p-10 hidden md:flex flex-col items-center justify-center relative transition-colors">
          
          {/* Círculo decorativo ao fundo para dar charme */}
          <div className="absolute w-72 h-72 bg-orange-50 rounded-full -z-0"></div>

          {/* Aqui você pode colocar uma tag <img> chamando a sua ilustração. 
              Por enquanto, criei um desenho com Tailwind imitando uma tela de celular e um usuário para não ficar vazio. */}
          <div className="relative z-10 w-64 h-80 bg-white border-4 border-gray-800 rounded-3xl shadow-xl flex flex-col items-center p-4 transition-colors">
            {/* Top do celular */}
            <div className="w-20 h-1.5 bg-gray-300 rounded-full mb-6"></div>
            
            {/* Ícone de Usuário Laranja */}
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>

            {/* Barras imitando texto */}
            <div className="w-full space-y-3">
              <div className="h-3 w-full bg-gray-100 rounded-full transition-colors"></div>
              <div className="h-3 w-5/6 bg-gray-100 rounded-full transition-colors"></div>
              <div className="h-3 w-4/6 bg-orange-200 rounded-full mt-4"></div>
            </div>
            
            {/* Botão no celular */}
            <div className="mt-auto w-full h-10 bg-orange-500 rounded-xl"></div>
          </div>
          
          <p className="mt-8 text-gray-400 text-sm font-medium relative z-10">
            Painel de Gestão e consulta de estoque para a equipe Delta. <br />
          </p>

        </div>
      </div>
    </main>
  );
}