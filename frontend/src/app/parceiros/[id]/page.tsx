"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { useMensagem } from "../../../components/ToastErro";

export default function DetalheParceiro() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id;


    const [parceiro, setParceiro] = useState<any>(null);
    const [formData, setFormData] = useState({ nome: "", nome_fantasia: "", mid: "" });
    const [carregando, setCarregando] = useState(true);
    const [loadingSalvar, setLoadingSalvar] = useState(false);
    const [loadingExcluir, setLoadingExcluir] = useState(false);
    const [mensagem, setMensagem] = useMensagem();
  
    useEffect(() => {
      async function carregar() {
        try {
          const res = await apiFetch(`/parceiros/${itemId}`, { cache: "no-store" });
          if (res.ok) {
            const dados = await res.json();
            setParceiro(dados);
            setFormData({
              nome: dados.nome || "",
              nome_fantasia: dados.nome_fantasia || "",
              mid: dados.mid || "",
            });
          }
        } finally {
          setCarregando(false);
        }
      }
      if (itemId) carregar();
    }, [itemId]);
  
    const handleSalvar = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoadingSalvar(true);
      setMensagem({ tipo: "", texto: "" });
      try {
        const res = await apiFetch(`/parceiros/${itemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: formData.nome,
            nome_fantasia: formData.nome_fantasia || null,
            mid: formData.mid || null,
          }),
        });
        if (res.ok) {
          const dados = await res.json();
          setParceiro(dados);
          setMensagem({ tipo: "sucesso", texto: "Parceiro atualizado." });
        } else {
          const erro = await res.json();
          setMensagem({ tipo: "erro", texto: erro.detail || "Não foi possível salvar." });
        }
      } finally {
        setLoadingSalvar(false);
      }
    };

    const handleExcluir = async () => {
      const confirmar = window.confirm(`Tem certeza que deseja remover o parceiro "${formData.nome}"?`);
      if (!confirmar) return;
      setLoadingExcluir(true);
      setMensagem({ tipo: "", texto: "" });
      try {
        const res = await apiFetch(`/parceiros/${itemId}`, { method: "DELETE" });
        if (res.ok) {
          router.push("/parceiros");
          return;
        }
        const erro = await res.json();
        setMensagem({ tipo: "erro", texto: erro.detail || "Não foi possível excluir." });
      } catch {
        setMensagem({ tipo: "erro", texto: "Erro de conexão com o servidor." });
      } finally {
        setLoadingExcluir(false);
      }
    };
  
    if (carregando) {
      return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
          <p className="text-orange-600 font-medium text-lg animate-pulse">Carregando parceiro...</p>
        </main>
      );
    }
  
    if (!parceiro) {
      return (
        <main className="p-10 max-w-3xl mx-auto">
          <p className="text-gray-600 dark:text-gray-300">Parceiro não encontrado.</p>
          <Link href="/parceiros" className="text-orange-600 font-semibold mt-4 inline-block">← Voltar</Link>
        </main>
      );
    }
  
    return (
      <main className="p-10 max-w-4xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-950">
        <Link href="/parceiros" className="text-sm font-semibold text-orange-600 mb-4 inline-block">← Parceiros</Link>
  
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm">
          {mensagem.texto && (
            <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {mensagem.texto}
            </div>
          )}
  
          <form onSubmit={handleSalvar} className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Razão Social *</label>
              <input required value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-black dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Nome Fantasia</label>
              <input value={formData.nome_fantasia} onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-black dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 dark:text-gray-300">MID</label>
              <input value={formData.mid} onChange={(e) => setFormData({ ...formData, mid: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-black dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4">
              <button
                type="button"
                onClick={handleExcluir}
                disabled={loadingExcluir || loadingSalvar}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loadingExcluir ? "Excluindo..." : "Excluir parceiro"}
              </button>
              <button type="submit" disabled={loadingSalvar || loadingExcluir} className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm disabled:opacity-50">
                {loadingSalvar ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
  
          <h2 className="text-lg font-bold mb-3 dark:text-gray-100">
            Máquinas vinculadas ({parceiro.dispositivos?.length || 0})
          </h2>
          <div className="space-y-2">
            {(parceiro.dispositivos || []).length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma máquina vinculada a este parceiro.</p>
            ) : (
              parceiro.dispositivos.map((maq: any) => (
                <div key={maq.id} className="flex justify-between items-center border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{maq.numero_serial}</p>
                    <p className="text-xs text-gray-500">{maq.modelo || "Sem modelo"} · {maq.estado || "—"}</p>
                  </div>
                  <span className="text-xs font-bold text-gray-500">
                    {maq.em_evento ? "Em evento" : "Fora de evento"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    );
  }


