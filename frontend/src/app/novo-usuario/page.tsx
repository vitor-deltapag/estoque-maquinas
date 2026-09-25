"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/api";
import { useMensagem } from "../../components/ToastErro";
import DropdownCustomizado from "../../components/DropdownCustomizado";
import ModalConfirmacao from "../../components/ModalConfirmacao";
import { OPCOES_PERFIL, rotuloPerfil } from "../../lib/permissoes";

type UsuarioMe = { permissoes?: { gerir_usuarios?: boolean } };

type AcessoCriado = {
  nome: string;
  email: string;
  senha: string;
  perfil: string;
  status: string;
};

const OPCOES_STATUS = [
  { value: "ATIVO", label: "Ativo" },
  { value: "INATIVO", label: "Inativo" },
];

function gerarSenhaProvisoria() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

function detalheErro(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

async function copiarTexto(texto: string) {
  await navigator.clipboard.writeText(texto);
}

export default function NovoUsuarioPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [status, setStatus] = useState("ATIVO");
  const [perfil, setPerfil] = useState("OPERACIONAL");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [confirmarAdmin, setConfirmarAdmin] = useState(false);
  const [acessoCriado, setAcessoCriado] = useState<AcessoCriado | null>(null);
  const [copiado, setCopiado] = useState("");
  const [mensagem, setMensagem] = useMensagem();

  useEffect(() => {
    const verificarPermissao = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      try {
        const res = await apiFetch("/usuarios/me");
        if (!res.ok) {
          router.replace("/");
          return;
        }
        const me: UsuarioMe = await res.json();
        if (!me.permissoes?.gerir_usuarios) router.replace("/");
      } catch {
        router.replace("/login");
      }
    };
    verificarPermissao();
  }, [router]);

  function gerarSenha() {
    const gerada = gerarSenhaProvisoria();
    setSenha(gerada);
    setConfirmarSenha(gerada);
    setMostrarSenha(true);
  }

  async function copiar(rotulo: string, texto: string) {
    try {
      await copiarTexto(texto);
      setCopiado(rotulo);
      window.setTimeout(() => setCopiado(""), 2000);
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível copiar. Selecione o texto manualmente." });
    }
  }

  async function copiarAcessoCompleto(acesso: AcessoCriado) {
    const bloco = `Acesso Estoque Delta\nE-mail: ${acesso.email}\nSenha provisória: ${acesso.senha}`;
    await copiar("acesso", bloco);
  }

  function novoCadastro() {
    setAcessoCriado(null);
    setNome("");
    setNomeFantasia("");
    setStatus("ATIVO");
    setPerfil("OPERACIONAL");
    setEmail("");
    setSenha("");
    setConfirmarSenha("");
    setMostrarSenha(true);
    setCopiado("");
    setMensagem({ tipo: "", texto: "" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nomeTrim = nome.trim();
    const emailTrim = email.trim().toLowerCase();
    if (!nomeTrim) {
      setMensagem({ tipo: "erro", texto: "Informe o nome completo." });
      return;
    }
    if (!emailTrim || !emailTrim.includes("@")) {
      setMensagem({ tipo: "erro", texto: "Informe um e-mail válido. É o login da pessoa." });
      return;
    }
    if (senha.length < 8) {
      setMensagem({ tipo: "erro", texto: "A senha provisória precisa ter pelo menos 8 caracteres." });
      return;
    }
    if (senha !== confirmarSenha) {
      setMensagem({ tipo: "erro", texto: "A senha e a confirmação não coincidem." });
      return;
    }
    if (perfil === "ADMIN") {
      setConfirmarAdmin(true);
      return;
    }
    await gravarAcesso(nomeTrim, emailTrim);
  }

  async function gravarAcesso(nomeTrim: string, emailTrim: string) {
    setConfirmarAdmin(false);
    setSalvando(true);
    setMensagem({ tipo: "", texto: "" });
    try {
      const response = await apiFetch("/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeTrim,
          nome_fantasia: nomeFantasia.trim() || null,
          status,
          perfil,
          email: emailTrim,
          senha,
        }),
      });
      if (response.ok) {
        setAcessoCriado({
          nome: nomeTrim,
          email: emailTrim,
          senha,
          perfil,
          status,
        });
        setMensagem({ tipo: "sucesso", texto: "Acesso criado. Copie a senha agora — ela não aparece de novo." });
        return;
      }
      const erro = await response.json().catch(() => null);
      setMensagem({ tipo: "erro", texto: detalheErro(erro, "Erro ao cadastrar usuário.") });
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão." });
    } finally {
      setSalvando(false);
    }
  }

  if (acessoCriado) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-2">Acesso criado</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Entregue estes dados para {acessoCriado.nome} entrar no sistema. A senha provisória não fica
          guardada na lista de usuários.
        </p>
        {mensagem.tipo === "sucesso" && (
          <p className="mb-4 text-sm text-green-700 dark:text-green-400">{mensagem.texto}</p>
        )}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3 mb-6">
          <p>
            <span className="text-sm text-gray-500">Nome</span>
            <br />
            <span className="font-medium">{acessoCriado.nome}</span>
          </p>
          <p>
            <span className="text-sm text-gray-500">Perfil</span>
            <br />
            <span className="font-medium">
              {rotuloPerfil(acessoCriado.perfil)} · {acessoCriado.status === "ATIVO" ? "Ativo" : "Inativo"}
            </span>
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0">
              <span className="text-sm text-gray-500">E-mail / login</span>
              <br />
              <span className="font-mono break-all">{acessoCriado.email}</span>
            </p>
            <button
              type="button"
              onClick={() => copiar("email", acessoCriado.email)}
              className="shrink-0 px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:hover:text-gray-900"
            >
              {copiado === "email" ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0">
              <span className="text-sm text-gray-500">Senha provisória</span>
              <br />
              <span className="font-mono break-all">{acessoCriado.senha}</span>
            </p>
            <button
              type="button"
              onClick={() => copiar("senha", acessoCriado.senha)}
              className="shrink-0 px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:hover:text-gray-900"
            >
              {copiado === "senha" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => copiarAcessoCompleto(acessoCriado)}
            className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600"
          >
            {copiado === "acesso" ? "Dados copiados" : "Copiar e-mail e senha"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/usuarios")}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:hover:text-gray-900"
          >
            Ver lista de usuários
          </button>
          <button
            type="button"
            onClick={novoCadastro}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:hover:text-gray-900"
          >
            Criar outro acesso
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Novo usuário</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Cria o login no Estoque Delta. A pessoa entra com o e-mail e a senha provisória que você
        definir aqui.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome completo</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nome fantasia (opcional)</label>
          <input
            type="text"
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">E-mail (login)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Perfil</label>
          <DropdownCustomizado value={perfil} onChange={setPerfil} options={OPCOES_PERFIL} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <DropdownCustomizado value={status} onChange={setStatus} options={OPCOES_STATUS} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium">Senha provisória</label>
            <button
              type="button"
              onClick={gerarSenha}
              className="text-sm text-orange-600 hover:underline"
            >
              Gerar senha
            </button>
          </div>
          <input
            type={mostrarSenha ? "text" : "password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
          <p className="mt-1 text-xs text-gray-500">Mínimo 8 caracteres. Guarde para entregar à pessoa.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirmar senha</label>
          <input
            type={mostrarSenha ? "text" : "password"}
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mostrarSenha}
            onChange={(e) => setMostrarSenha(e.target.checked)}
          />
          Mostrar senha
        </label>
        {mensagem.tipo === "erro" && <p className="text-red-600 text-sm">{mensagem.texto}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {salvando ? "Criando acesso..." : "Criar acesso"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/usuarios")}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:hover:text-gray-900"
          >
            Cancelar
          </button>
        </div>
      </form>
      <ModalConfirmacao
        aberto={confirmarAdmin}
        titulo="Criar acesso de admin?"
        texto="Este acesso será administrador: poderá cadastrar usuários, clientes e o restante do estoque."
        confirmarLabel="Confirmar"
        carregando={salvando}
        onCancelar={() => setConfirmarAdmin(false)}
        onConfirmar={() => gravarAcesso(nome.trim(), email.trim().toLowerCase())}
      />
    </div>
  );
}
