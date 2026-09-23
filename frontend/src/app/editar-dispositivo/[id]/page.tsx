"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { useMensagem } from "../../../components/ToastErro";

export default function EditarDispositivo() {
  const router = useRouter();
  const params = useParams(); 
  const id = params.id;

  const [clientes, setClientes] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useMensagem();

  const [formData, setFormData] = useState({
    modelo: "", numero_serial: "", estado: "", aquisicao: "", cliente: "", fornecedor: ""
  });

  useEffect(() => {
    async function carregarDados() {
      try {
        const resClientes = await apiFetch(`/clientes`);
        const resFornecedores = await apiFetch(`/fornecedores`);
        const resDispositivo = await apiFetch(`/dispositivos/${id}`);

        if (resClientes.ok) setClientes(await resClientes.json());
        if (resFornecedores.ok) setFornecedores(await resFornecedores.json());
        
        if (resDispositivo.ok) {
          const disp = await resDispositivo.json();
          setFormData({
            modelo: disp.modelo || "",
            numero_serial: (disp.numero_serial || "").toUpperCase(),
            estado: disp.estado || "",
            aquisicao: disp.aquisicao || "",
            cliente: disp.cliente || "",
            fornecedor: disp.fornecedor || "",
          });
        }
      } catch (error) {
        console.error("Erro ao carregar os dados:", error);
      }
    }
    carregarDados();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const valor = e.target.name === "numero_serial" ? e.target.value.toUpperCase() : e.target.value;
    setFormData({ ...formData, [e.target.name]: valor });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      modelo: formData.modelo || null,
      numero_serial: (formData.numero_serial || "").trim().toUpperCase() || null,
      estado: formData.estado || null,
      aquisicao: formData.aquisicao || null,
      cliente: formData.cliente ? parseInt(formData.cliente) : null,
      fornecedor: formData.fornecedor ? parseInt(formData.fornecedor) : null,
    };

    try {
      const response = await apiFetch(`/dispositivos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setMensagem({ tipo: "sucesso", texto: "Dispositivo atualizado com sucesso!" });
        setTimeout(() => router.push("/dispositivos"), 1500); // Redireciona para a lista
      } else {
        const dadosErro = await response.json();
        setMensagem({ tipo: "erro", texto: dadosErro.detail || "Erro ao atualizar." });
      }
    } catch (error) {
      setMensagem({ tipo: "erro", texto: "Erro de conexão." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 dark:bg-gray-950 transition-colors">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md border border-gray-100 p-8 dark:bg-gray-900 transition-colors">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 dark:text-gray-100 transition-colors">Editar Dispositivo #{id}</h1>
        
        {mensagem.texto && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Modelo *</label>
              <select required name="modelo" value={formData.modelo} onChange={handleChange} className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-medium focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors">
                <option value="">Selecione...</option>
                <option value="P2 BIN">P2 BIN</option>
                <option value="X990">X990</option>
                <option value="S920">S920</option>
                <option value="A910">A910</option>
                <option value="L300">L300</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Número Serial *</label>
              <input required type="text" name="numero_serial" value={formData.numero_serial} onChange={handleChange} placeholder="Ex: 123456789ABC" className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-medium focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors"/>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Estado Atual</label>
            <select name="estado" value={formData.estado} onChange={handleChange} className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-medium focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors">
              <option value="">Selecione...</option>
              <option value="NO CLIENTE">NO CLIENTE</option>
              <option value="ESTOQUE">ESTOQUE</option>
              <option value="REPARO">REPARO</option>
              <option value="MAQUINA PERDIDA">MÁQUINA PERDIDA</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Aquisição</label>
            <select name="aquisicao" value={formData.aquisicao} onChange={handleChange} className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-medium focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors">
              <option value="">Selecione...</option>
              <option value="ALUGADA">Alugada</option>
              <option value="COMPRADA">Comprada</option>
            </select>
          </div>

          <hr className="border-gray-200 dark:border-gray-800 transition-colors" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Fornecedor</label>
              <select name="fornecedor" value={formData.fornecedor} onChange={handleChange} className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-medium focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors">
                <option value="">Nenhum</option>
                {fornecedores.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.codigo ? `${f.codigo} - ` : ""}{f.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Cliente Destinatário</label>
              <select name="cliente" value={formData.cliente} onChange={handleChange} className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-medium focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors">
                <option value="">Nenhum (Em estoque / Reparo)</option>
                {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Link href="/dispositivos" className="w-1/2 text-center border border-gray-300 hover:bg-gray-100 hover:text-gray-900 text-gray-700 font-semibold p-2.5 rounded-lg transition-colors text-sm dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-900">Cancelar</Link>
            <button type="submit" disabled={loading} className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-semibold p-2.5 rounded-lg transition-colors text-sm disabled:opacity-50">
              {loading ? "Atualizando..." : "Atualizar Dispositivo"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
