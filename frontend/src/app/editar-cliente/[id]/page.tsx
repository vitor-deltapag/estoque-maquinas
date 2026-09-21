"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { useMensagem } from "../../../components/ToastErro";
import DropdownCustomizado from "../../../components/DropdownCustomizado";

export default function EditarCliente() {
  const router = useRouter();
  const params = useParams();
  const id = params.id; // Captura o ID do cliente direto da URL
  
  const [loading, setLoading] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [mensagem, setMensagem] = useMensagem();

  const [formData, setFormData] = useState({
    nome: "",
    nome_fantasia: "",
    mid: "",
    parceiro: false
  });

  // 1. BUSCA OS DADOS DO CLIENTE ASSIM QUE A TELA ABRE
  useEffect(() => {
    async function carregarCliente() {
      try {
        const response = await apiFetch(`/clientes/${id}`);
        
        if (response.ok) {
          const cliente = await response.json();
          setFormData({
            nome: cliente.nome || "",
            nome_fantasia: cliente.nome_fantasia || "",
            mid: cliente.mid || "",
            parceiro: Boolean(cliente.parceiro)
          });
        } else {
          setMensagem({ tipo: "erro", texto: "Erro ao encontrar o cliente no banco de dados." });
        }
      } catch (error) {
        console.error("Erro ao carregar cliente:", error);
        setMensagem({ tipo: "erro", texto: "Erro de conexão ao buscar dados do cliente." });
      } finally {
        setCarregandoDados(false);
      }
    }

    if (id) {
      carregarCliente();
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 2. ENVIA AS ALTERAÇÕES (PUT) PARA O BACKEND
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagem({ tipo: "", texto: "" });

    const payload = {
      nome: formData.nome,
      nome_fantasia: formData.nome_fantasia || null,
      mid: formData.mid || null,
      parceiro: formData.parceiro
    };

    try {
      const response = await apiFetch(`/clientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setMensagem({ tipo: "sucesso", texto: "Cliente atualizado com sucesso!" });
        // Aguarda 1.5 segundos para o usuário ver o sucesso e volta para a lista
        setTimeout(() => router.push("/clientes"), 1500);
      } else {
        const dadosErro = await response.json();
        setMensagem({ tipo: "erro", texto: dadosErro.detail || "Erro ao atualizar cliente." });
      }
    } catch (error) {
      setMensagem({ tipo: "erro", texto: "Erro de conexão com o servidor." });
    } finally {
      setLoading(false);
    }
  };

  if (carregandoDados) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-gray-950 transition-colors">
        <p className="text-gray-500 font-medium">Buscando informações do cliente...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 dark:bg-gray-950 transition-colors">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-md border border-gray-100 p-8 dark:bg-gray-900 transition-colors">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 dark:text-gray-100 transition-colors">Editar Cliente #{id}</h1>
        
        {mensagem.texto && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300 transition-colors">MID</label>
            <input 
              type="text" 
              name="mid"
              value={formData.mid} 
              onChange={handleChange} 
              placeholder="Ex: 1153893"
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium dark:border-gray-700 dark:text-white transition-colors" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300 transition-colors">Razão Social *</label>
            <input 
              required 
              type="text" 
              name="nome"
              value={formData.nome} 
              onChange={handleChange} 
              placeholder="Ex: NUTRARI DISTRIBUIDORA DE ALIMENTOS"
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium dark:border-gray-700 dark:text-white transition-colors" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300 transition-colors">Nome Fantasia</label>
            <input 
              type="text" 
              name="nome_fantasia"
              value={formData.nome_fantasia} 
              onChange={handleChange} 
              placeholder="Ex: BRIAMAR POINT"
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-black font-medium dark:border-gray-700 dark:text-white transition-colors" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300 transition-colors">Parceiro</label>
            <DropdownCustomizado
              value={formData.parceiro ? "sim" : "nao"}
              onChange={(valor) => setFormData({ ...formData, parceiro: valor === "sim" })}
              options={[
                { value: "nao", label: "Não" },
                { value: "sim", label: "Sim" },
              ]}
            />
          </div>

          <div className="flex gap-4 mt-6">
            <Link 
              href="/clientes" 
              className="w-1/2 text-center border border-gray-300 hover:bg-gray-100 hover:text-gray-900 text-gray-700 font-semibold p-2.5 rounded-lg transition-colors text-sm dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-900"
            >
              Cancelar
            </Link>
            
            <button 
              type="submit" 
              disabled={loading} 
              className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-semibold p-2.5 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              {loading ? "Atualizando..." : "Atualizar Cliente"}
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}