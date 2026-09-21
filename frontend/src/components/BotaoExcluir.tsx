// src/components/BotaoExcluir.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { useToastErro } from "./ToastErro";

interface BotaoExcluirProps {
  id: number;
  rota: string; // ex: "dispositivos", "clientes"
}

export default function BotaoExcluir({ id, rota }: BotaoExcluirProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const mostrarErro = useToastErro();

  const handleDelete = async () => {
    // Pede confirmação antes de excluir
    const confirmacao = window.confirm("Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.");
    if (!confirmacao) return;

    setLoading(true);

    try {
      const response = await apiFetch(`/${rota}/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Atualiza a tela automaticamente para sumir com o item da tabela
        router.refresh();
      } else {
        const erro = await response.json();
        mostrarErro(erro.detail || "Erro ao excluir o item.");
      }
    } catch (error) {
      mostrarErro("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-red-500 hover:text-red-700 font-semibold transition-colors disabled:opacity-50 text-sm"
      title="Excluir"
    >
      {loading ? "..." : "Excluir"}
    </button>
  );
}