"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { useMensagem } from "../../components/ToastErro";

export default function ListaDistribuidores() {
  const [distribuidores, setDistribuidores] = useState<any[]>([]);
  const [buscaTexto, setBuscaTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [loadingExcluir, setLoadingExcluir] = useState(false);
  const [mensagemModal, setMensagemModal] = useMensagem();
  const [formData, setFormData] = useState({
    id: "", nome: "", codigo: "", status: "",
  });

  const carregar = async () => {
    try {
      const response = await apiFetch("/fornecedores", { cache: "no-store" });
      if (response.ok) {
        const dados = await response.json();
        setDistribuidores(Array.isArray(dados) ? dados : []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = distribuidores.filter((item) => {
    if (!buscaTexto) return true;
    const termo = buscaTexto.toLowerCase();
    return (
      item.nome?.toLowerCase().includes(termo) ||
      item.codigo?.toLowerCase().includes(termo)
    );
  });

  const handleCardClick = (item: any) => {
    setFormData({
      id: item.id,
      nome: item.nome || "",
      codigo: item.codigo || "",
      status: item.status || "",
    });
    setMensagemModal({ tipo: "", texto: "" });
    setModalAberto(true);
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSalvar(true);
    setMensagemModal({ tipo: "", texto: "" });
    try {
      const response = await apiFetch(`/fornecedores/${formData.id}`, {
        method: "PUT",
        body: JSON.stringify({
          nome: formData.nome,
          codigo: formData.codigo || null,
          status: formData.status || null,
        }),
      });
      if (response.ok) {
        setMensagemModal({ tipo: "sucesso", texto: "Distribuidor atualizado com sucesso!" });
        await carregar();
        setTimeout(() => setModalAberto(false), 1000);
      } else {
        const erro = await response.json();
        setMensagemModal({ tipo: "erro", texto: erro.detail || "Erro ao salvar alterações." });
      }
    } catch {
      setMensagemModal({ tipo: "erro", texto: "Erro de conexão com o servidor." });
    } finally {
      setLoadingSalvar(false);
    }
  };

  const handleExcluir = async () => {
    const confirmar = window.confirm(`Tem certeza absoluta que deseja remover o distribuidor "${formData.nome}"?`);
    if (!confirmar) return;
    setLoadingExcluir(true);
    setMensagemModal({ tipo: "", texto: "" });
    try {
      const response = await apiFetch(`/fornecedores/${formData.id}`, { method: "DELETE" });
      if (response.ok) {
        setMensagemModal({ tipo: "sucesso", texto: "Distribuidor removido com sucesso!" });
        await carregar();
        setTimeout(() => setModalAberto(false), 1000);
      } else {
        const erro = await response.json();
        setMensagemModal({ tipo: "erro", texto: erro.detail || "Erro ao tentar excluir o distribuidor." });
      }
    } catch {
      setMensagemModal({ tipo: "erro", texto: "Erro de rede ao processar exclusão." });
    } finally {
      setLoadingExcluir(false);
    }
  };

  if (carregando) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-gray-950 transition-colors">
        <p className="text-orange-600 font-medium text-lg animate-pulse">Carregando distribuidores...</p>
      </main>
    );
  }

  return (
    <main className="p-10 max-w-7xl mx-auto relative min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-orange-600">Distribuidores</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Cadastre e consulte os distribuidores do estoque.</p>
        </div>
        <Link
          href="/distribuidores/novo"
          className="w-full md:w-auto text-center bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm shadow-sm transition-colors"
        >
          + Novo Distribuidor
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-8 relative dark:bg-gray-900 dark:border-gray-800 transition-colors">
        <div className="relative">
          <input
            type="text"
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
            placeholder="Digite o nome ou código do distribuidor para filtrar..."
            className="w-full bg-gray-50 border border-gray-300 rounded-lg py-3 px-4 pl-24 text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder-gray-400 dark:bg-gray-950 dark:border-gray-700 dark:text-white dark:focus:bg-gray-950"
          />
          <span className="absolute left-4 top-3.5 text-gray-500 font-bold text-sm font-mono pointer-events-none">BUSCA:</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtrados.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 font-medium bg-white rounded-xl border border-dashed border-gray-300 dark:bg-gray-900 dark:border-gray-700 transition-colors">
            {buscaTexto ? "Nenhum distribuidor localizado para a busca." : "Nenhum distribuidor cadastrado."}
          </div>
        ) : (
          filtrados.map((item: any) => (
            <div
              key={item.id}
              onClick={() => handleCardClick(item)}
              className="bg-white border border-gray-200 hover:border-orange-500 rounded-xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group dark:bg-gray-900 dark:border-gray-800"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 py-1 px-2.5 rounded-md transition-colors">
                    CÓD: {item.codigo || "S/N"}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 mt-2 truncate dark:text-white transition-colors">
                  {item.nome}
                </h3>
              </div>
              <div className="mt-5 border-t pt-3 flex justify-end items-center text-xs text-gray-400 font-medium">
                <span className="text-orange-600 font-bold group-hover:translate-x-1 transition-transform">Editar Cadastro →</span>
              </div>
            </div>
          ))
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg p-8 dark:bg-gray-900 dark:border-gray-800 transition-colors">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 transition-colors">Ficha do Distribuidor</h2>
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
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Nome *</label>
                <input
                  required
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-bold outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Código</label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ex: 1389"
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-semibold outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t mt-4">
                <button
                  type="button"
                  onClick={handleExcluir}
                  disabled={loadingExcluir}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loadingExcluir ? "Excluindo..." : "Excluir Distribuidor"}
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
