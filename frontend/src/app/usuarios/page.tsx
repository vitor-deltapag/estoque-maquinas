"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/api";
import { useMensagem } from "../../components/ToastErro";
import DropdownCustomizado from "../../components/DropdownCustomizado";
import ModalConfirmacao from "../../components/ModalConfirmacao";
import { OPCOES_PERFIL, ROTULOS_PERMISSAO, permissoesDoPerfil, rotuloPerfil, type Permissoes } from "../../lib/permissoes";

export default function ListaUsuarios() {
  const router = useRouter();
  
  // Estados
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [buscaNome, setBuscaNome] = useState("");
  const [carregando, setCarregando] = useState(true);

  // Estados do Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [loadingExcluir, setLoadingExcluir] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [mensagemModal, setMensagemModal] = useMensagem();

  const [formData, setFormData] = useState({
    id: "", nome: "", nome_fantasia: "", email: "", status: "", perfil: "OPERACIONAL",
    permissoes: permissoesDoPerfil("OPERACIONAL") as Permissoes,
  });

  // 1. CARREGA OS USUÁRIOS DO BANCO
  const carregarUsuarios = async () => {
    try {
      const response = await apiFetch("/usuarios", { cache: "no-store" });
      if (response.ok) {
        const dados = await response.json();
        setUsuarios(Array.isArray(dados) ? dados : []);
      }
    } catch (error) {
      console.error("Erro ao conectar com a API:", error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    const verificarPermissao = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      try {
        const res = await apiFetch("/usuarios/me");
        if (res.ok) {
          const data = await res.json();
          if (!data.permissoes?.gerir_usuarios) {
            router.push("/");
            return;
          }
        }
      } catch (error) {
        console.error(error);
      }

      await carregarUsuarios();
    };
    
    verificarPermissao();
  }, [router]);

  // 2. FILTRO EM TEMPO REAL POR NOME
  const usuariosFiltrados = usuarios.filter((user) => {
    if (!buscaNome) return true;
    const q = buscaNome.toLowerCase();
    return (
      user.nome?.toLowerCase().includes(q) ||
      user.nome_fantasia?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q)
    );
  });

  // 3. ABRE O POP-UP AO CLICAR NO CARD
  const handleCardClick = (user: any) => {
    setFormData({
      id: user.id,
      nome: user.nome || "",
      nome_fantasia: user.nome_fantasia || "",
      email: user.email || "",
      status: user.status || "ATIVO",
      perfil: user.perfil === "COMUM" ? "OPERACIONAL" : (user.perfil || "OPERACIONAL"),
      permissoes: user.permissoes || permissoesDoPerfil(user.perfil),
    });
    setMensagemModal({ tipo: "", texto: "" });
    setModalAberto(true);
  };

  // 4. SALVA AS ALTERAÇÕES
  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSalvar(true);
    setMensagemModal({ tipo: "", texto: "" });

    try {
      const response = await apiFetch(`/usuarios/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMensagemModal({ tipo: "sucesso", texto: "Usuário atualizado com sucesso!" });
        await carregarUsuarios();
        setTimeout(() => setModalAberto(false), 1000);
      } else {
        const erro = await response.json();
        setMensagemModal({ tipo: "erro", texto: erro.detail || "Erro ao salvar alterações." });
      }
    } catch (error) {
      setMensagemModal({ tipo: "erro", texto: "Erro de conexão com o servidor." });
    } finally {
      setLoadingSalvar(false);
    }
  };

  // 5. EXCLUI O USUÁRIO
  const handleExcluirUsuario = async () => {
    setLoadingExcluir(true);
    setMensagemModal({ tipo: "", texto: "" });

    try {
      const response = await apiFetch(`/usuarios/${formData.id}`, { method: "DELETE" });

      if (response.ok) {
        setConfirmarExclusao(false);
        setMensagemModal({ tipo: "sucesso", texto: "Usuário removido com sucesso!" });
        await carregarUsuarios();
        setTimeout(() => setModalAberto(false), 1000);
      } else {
        setConfirmarExclusao(false);
        setMensagemModal({ tipo: "erro", texto: "Erro ao tentar excluir o usuário." });
      }
    } catch (error) {
      setConfirmarExclusao(false);
      setMensagemModal({ tipo: "erro", texto: "Erro de rede ao processar exclusão." });
    } finally {
      setLoadingExcluir(false);
    }
  };

  const formatarData = (dataIso: string) => {
    if (!dataIso) return "-";
    return new Date(dataIso).toLocaleDateString("pt-BR");
  };

  if (carregando) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center transition-colors duration-300">
        <p className="text-orange-600 dark:text-orange-500 font-medium text-lg animate-pulse">
          Carregando usuários...
        </p>
      </main>
    );
  }

  return (
    <main className="p-10 max-w-7xl mx-auto relative min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">

      {/* TOPO: TÍTULO E BOTÃO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-orange-600 dark:text-orange-500">Gerenciar Usuários</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Controle de acessos, administradores e colaboradores.</p>
        </div>

        <Link
          href="/novo-usuario"
          className="w-full md:w-auto text-center bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm shadow-sm transition-colors"
        >
          + Novo Usuário
        </Link>
      </div>

      {/* BARRA DE PESQUISA */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-8 transition-colors">
        <div className="relative">
          <input
            type="text"
            value={buscaNome}
            onChange={(e) => setBuscaNome(e.target.value)}
            placeholder="Digite o nome, fantasia ou e-mail do usuário..."
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg py-3 px-4 pl-24 text-black dark:text-white font-semibold outline-none focus:ring-2 focus:ring-orange-500 transition-all placeholder-gray-400"
          />
          <span className="absolute left-4 top-3.5 text-gray-500 dark:text-gray-400 font-bold text-sm font-mono pointer-events-none">BUSCA:</span>
        </div>
      </div>

      {/* GRID DE CARDS DOS USUÁRIOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {usuariosFiltrados.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 font-medium bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 transition-colors">
            Nenhum usuário localizado para "{buscaNome}".
          </div>
        ) : (
          usuariosFiltrados.map((user: any) => (
            <div
              key={user.id}
              onClick={() => handleCardClick(user)}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-orange-500 dark:hover:border-orange-500 rounded-xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  {/* Etiqueta de Perfil de Acesso */}
                  <span className={`text-xs font-bold py-1 px-2.5 rounded-md transition-colors ${user.perfil === 'ADMIN'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                    {rotuloPerfil(user.perfil)}
                  </span>

                  {/* Bolinha de Status */}
                  <span className={`w-2.5 h-2.5 rounded-full ${user.status === 'ATIVO' ? 'bg-green-500' : 'bg-gray-400'}`} title={user.status || "INATIVO"} />
                </div>

                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mt-2 transition-colors truncate">
                  {user.nome}
                </h3>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1 truncate">
                  {user.nome_fantasia || "Sem Nome Fantasia"}
                </p>
                <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-2 truncate">
                  {user.email || "Sem e-mail"}
                </p>
              </div>

              <div className="mt-5 border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between items-center text-xs text-gray-400 dark:text-gray-500 font-medium transition-colors">
                <span>Criado em: {formatarData(user.created_at)}</span>
                <span className="text-orange-600 dark:text-orange-400 font-bold group-hover:translate-x-1 transition-transform">Editar →</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* POP-UP DE EDIÇÃO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 w-full max-w-lg p-8 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 transition-colors">

            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white transition-colors">Editar Usuário</h2>
                <p className="text-xs text-gray-400 mt-1 font-medium">Registro do Sistema ID #{formData.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xl font-bold bg-red-100 dark:bg-red-900/30 h-8 w-8 rounded-full flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {mensagemModal.texto && (
              <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${mensagemModal.tipo === "sucesso" ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}>
                {mensagemModal.texto}
              </div>
            )}

            <form onSubmit={handleSalvarEdicao} className="space-y-4">

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Nome Completo *</label>
                <input required type="text" value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-black dark:text-white font-semibold outline-none focus:ring-2 focus:ring-orange-500 transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Nome Fantasia / Empresa</label>
                <input type="text" value={formData.nome_fantasia} onChange={e => setFormData({ ...formData, nome_fantasia: e.target.value })} className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-black dark:text-white font-semibold outline-none focus:ring-2 focus:ring-orange-500 transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">E-mail / login</label>
                <input
                  type="text"
                  value={formData.email}
                  readOnly
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-black dark:text-white font-semibold outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">O login não se altera por aqui. Para senha nova, a pessoa usa Esqueci a senha.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Perfil de Acesso</label>
                  <DropdownCustomizado
                    value={formData.perfil}
                    onChange={(perfil) => setFormData({ ...formData, perfil, permissoes: permissoesDoPerfil(perfil) })}
                    options={OPCOES_PERFIL}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                  <DropdownCustomizado
                    value={formData.status}
                    onChange={(status) => setFormData({ ...formData, status })}
                    options={[
                      { value: "ATIVO", label: "ATIVO" },
                      { value: "INATIVO", label: "INATIVO" },
                    ]}
                  />
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Permissões</p>
                {ROTULOS_PERMISSAO.map((item) => (
                  <label key={item.chave} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.permissoes[item.chave])}
                      onChange={(e) => setFormData({
                        ...formData,
                        permissoes: { ...formData.permissoes, [item.chave]: e.target.checked },
                      })}
                    />
                    {item.label}
                  </label>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t border-gray-200 dark:border-gray-800 mt-6">

                <button
                  type="button"
                  onClick={() => setConfirmarExclusao(true)}
                  disabled={loadingExcluir}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  🗑️ {loadingExcluir ? "Excluindo..." : "Excluir Usuário"}
                </button>

                <button
                  type="submit"
                  disabled={loadingSalvar || loadingExcluir}
                  className="w-full sm:w-36 bg-orange-600 hover:bg-orange-700 text-white font-semibold p-2.5 rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                  {loadingSalvar ? "Salvando..." : "Salvar"}
                </button>

              </div>
            </form>

          </div>
        </div>
      )}
      <ModalConfirmacao
        aberto={confirmarExclusao}
        titulo="Excluir usuário?"
        texto={`O acesso de ${formData.nome || "este usuário"} será removido. Esta ação não pode ser desfeita.`}
        confirmarLabel="Confirmar exclusão"
        carregando={loadingExcluir}
        onCancelar={() => setConfirmarExclusao(false)}
        onConfirmar={handleExcluirUsuario}
      />
    </main>
  );
}