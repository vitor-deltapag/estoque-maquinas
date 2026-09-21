"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { useMensagem } from "../../components/ToastErro";

export default function NovoFornecedor() {
  const router = useRouter();

  // Estados separados para cada campo
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState(""); // <-- Novo estado para o Código

  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useMensagem();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagem({ tipo: "", texto: "" });

    try {
      const response = await apiFetch(`/fornecedores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome,
          codigo: codigo || null // <-- Envia o código se existir, senão envia null
        }),
      });

      if (response.ok) {
        setMensagem({ tipo: "sucesso", texto: "Fornecedor cadastrado com sucesso!" });
        setNome("");
        setCodigo(""); // Limpa o campo do código após salvar
      } else {
        setMensagem({ tipo: "erro", texto: "Erro ao cadastrar fornecedor." });
      }
    } catch (error) {
      setMensagem({ tipo: "erro", texto: "Erro de conexão com o servidor." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 dark:bg-gray-950 transition-colors">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-md border border-gray-100 p-8 dark:bg-gray-900 transition-colors">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 dark:text-gray-100 transition-colors">Cadastrar Fornecedor</h1>

        {mensagem.texto && (
          <div className={`mb-4 p-4 rounded-lg text-sm font-medium ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Novo input: Código do Fornecedor */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300 transition-colors">Código do Fornecedor*</label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex: 1389"
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-orange-500 text-black font-medium dark:border-gray-700 dark:text-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300 transition-colors">Nome do Fornecedor*</label>
            <input
              required
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Smartpag"
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-orange-500 text-black font-medium dark:border-gray-700 dark:text-white transition-colors"
            />
          </div>

          <div className="flex gap-4 mt-6">
            <Link href="/cadastros" className="w-1/2 text-center border border-gray-300 hover:bg-gray-100 hover:text-gray-900 text-gray-700 font-semibold p-2.5 rounded-lg transition-colors dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-900">Voltar</Link>
            <button type="submit" disabled={loading} className="w-1/2 bg-orange-600 hover:bg-orange-700 text-white font-semibold p-2.5 rounded-lg transition-colors">
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}