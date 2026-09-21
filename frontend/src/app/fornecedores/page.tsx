"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { useMensagem } from "../../components/ToastErro";

export default function ListaFornecedores() {
  // Estados do sistema
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [buscaNome, setBuscaNome] = useState("");
  const [carregando, setCarregando] = useState(true);

  // Estados do Modal Detalhado (Pop-up)
  const [modalAberto, setModalAberto] = useState(false);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [loadingExcluir, setLoadingExcluir] = useState(false);
  const [mensagemModal, setMensagemModal] = useMensagem();

  // Dados do formulário interno do Pop-up
  const [formData, setFormData] = useState({
    id: "", nome: "", codigo: ""
  });

  // 1. CARREGA OS FORNECEDORES DO BANCO
  const carregarFornecedores = async () => {
    try {
      const response = await apiFetch(`/fornecedores`, { cache: "no-store" });
      if (response.ok) {
        const dados = await response.json();
        setFornecedores(Array.isArray(dados) ? dados : []);
      }
    } catch (error) {
      console.error("Erro ao conectar com a API:", error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarFornecedores();
  }, []);

  // 2. FILTRO EM TEMPO REAL POR NOME OU CÓDIGO
  const fornecedoresFiltrados = fornecedores.filter((f) => {
    if (!buscaNome) return true;
    const termoBusca = buscaNome.toLowerCase();
    return (
      f.nome?.toLowerCase().includes(termoBusca) ||
      f.codigo?.toLowerCase().includes(termoBusca)
    );
  });

  // 3. ABRE O POP-UP AO CLICAR NO CARD
  const handleCardClick = (fornecedor: any) => {
    setFormData({
      id: fornecedor.id,
      nome: fornecedor.nome || "",
      codigo: fornecedor.codigo || ""
    });
    setMensagemModal({ tipo: "", texto: "" });
    setModalAberto(true);
  };

  // 4. SALVA AS ALTERAÇÕES (PUT)
  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSalvar(true);
    setMensagemModal({ tipo: "", texto: "" });

    try {
      const response = await apiFetch(`/fornecedores/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.nome,
          codigo: formData.codigo || null
        }),
      });

      if (response.ok) {
        setMensagemModal({ tipo: "sucesso", texto: "Fornecedor atualizado com sucesso!" });
        await carregarFornecedores();
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

  // 5. EXCLUI O FORNECEDOR (DELETE)
  const handleExcluirFornecedor = async () => {
    const confirmar = window.confirm(`Tem certeza absoluta que deseja remover o fornecedor "${formData.nome}"?`);
    if (!confirmar) return;

    setLoadingExcluir(true);
    setMensagemModal({ tipo: "", texto: "" });

    try {
      const response = await apiFetch(`/fornecedores/${formData.id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setMensagemModal({ tipo: "sucesso", texto: "Fornecedor removido com sucesso!" });
        await carregarFornecedores();
        setTimeout(() => setModalAberto(false), 1000);
      } else {
        // Se houver máquinas vinculadas, o backend envia um erro 400 detalhado
        const erro = await response.json();
        setMensagemModal({ tipo: "erro", texto: erro.detail || "Erro ao tentar excluir o fornecedor." });
      }
    } catch (error) {
      setMensagemModal({ tipo: "erro", texto: "Erro de rede ao processar exclusão." });
    } finally {
      setLoadingExcluir(false);
    }
  };

  if (carregando) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-gray-950 transition-colors">
        <p className="text-orange-600 font-medium text-lg animate-pulse">
          Carregando fornecedores...
        </p>
      </main>
    );
  }

  return (
    <main className="p-10 max-w-7xl mx-auto relative min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">

      {/* TOPO: TÍTULO E BOTÃO DE CRIAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-orange-600">Fornecedores</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Gerencie as empresas e origens das máquinas do estoque.</p>
        </div>

        <Link
          href="/novo-fornecedor"
          className="w-full md:w-auto text-center bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm shadow-sm transition-colors"
        >
          + Novo Fornecedor
        </Link>
      </div>

      {/* BARRA DE PESQUISA */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-8 relative dark:bg-gray-900 dark:border-gray-800 transition-colors">
        <div className="relative">
          <input
            type="text"
            value={buscaNome}
            onChange={(e) => setBuscaNome(e.target.value)}
            placeholder="Digite o nome ou código do fornecedor para filtrar..."
            className="w-full bg-gray-50 border border-gray-300 rounded-lg py-3 px-4 pl-24 text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder-gray-400 dark:bg-gray-950 dark:border-gray-700 dark:text-white dark:focus:bg-gray-950"
          />
          <span className="absolute left-4 top-3.5 text-gray-500 font-bold text-sm font-mono pointer-events-none">BUSCA:</span>
        </div>
      </div>

      {/* GRID DE CARDS DOS FORNECEDORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {fornecedoresFiltrados.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 font-medium bg-white rounded-xl border border-dashed border-gray-300 dark:bg-gray-900 dark:border-gray-700 transition-colors">
            Nenhum fornecedor localizado para o filtro "{buscaNome}".
          </div>
        ) : (
          fornecedoresFiltrados.map((f: any) => (
            <div
              key={f.id}
              onClick={() => handleCardClick(f)}
              className="bg-white border border-gray-200 hover:border-orange-500 rounded-xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group dark:bg-gray-900 dark:border-gray-800"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 py-1 px-2.5 rounded-md transition-colors">
                    ID #{f.id}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 mt-2 truncate dark:text-white transition-colors">
                  {f.nome}
                </h3>
                <p className="text-sm font-bold text-gray-400 font-mono mt-1">
                  CÓD: {f.codigo || "S/N"}
                </p>
              </div>

              <div className="mt-5 border-t pt-3 flex justify-end items-center text-xs text-gray-400 font-medium">
                <span className="text-orange-600 font-bold group-hover:translate-x-1 transition-transform">Editar Cadastro →</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* =======================================================
          POP-UP INTEGRADO: EDIÇÃO + EXCLUSÃO
         ======================================================= */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg p-8 animate-in fade-in zoom-in-95 duration-150 dark:bg-gray-900 dark:border-gray-800 transition-colors">

            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 transition-colors">Ficha do Fornecedor</h2>
                <p className="text-xs text-gray-400 mt-1 font-medium">Registro do Sistema ID #{formData.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="text-red-400 hover:text-red-600 text-xl font-bold bg-red-100 h-8 w-8 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {mensagemModal.texto && (
              <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${mensagemModal.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {mensagemModal.texto}
              </div>
            )}

            <form onSubmit={handleSalvarEdicao} className="space-y-5">

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Nome do Fornecedor *</label>
                <input
                  required
                  type="text"
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-bold outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Código (Opcional)</label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={e => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ex: FORN-001"
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-semibold outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t mt-4">

                <button
                  type="button"
                  onClick={handleExcluirFornecedor}
                  disabled={loadingExcluir}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  🗑️ {loadingExcluir ? "Excluindo..." : "Excluir Fornecedor"}
                </button>

                <button
                  type="submit"
                  disabled={loadingSalvar || loadingExcluir}
                  className="w-full sm:w-44 bg-amber-500 hover:bg-amber-600 text-white font-semibold p-2.5 rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                  {loadingSalvar ? "Salvando..." : "Salvar Alterações"}
                </button>

              </div>
            </form>

          </div>
        </div>
      )}
    </main>
  );
}