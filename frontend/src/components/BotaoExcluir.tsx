// src/components/BotaoExcluir.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { useToastErro } from "./ToastErro";
import ModalConfirmacao from "./ModalConfirmacao";

interface BotaoExcluirProps {
  id: number;
  rota: string; // ex: "dispositivos", "clientes"
}

export default function BotaoExcluir({ id, rota }: BotaoExcluirProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);
  const mostrarErro = useToastErro();

  const handleDelete = async () => {
    setLoading(true);

    try {
      const response = await apiFetch(`/${rota}/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAberto(false);
        router.refresh();
      } else {
        const erro = await response.json();
        setAberto(false);
        mostrarErro(erro.detail || "Erro ao excluir o item.");
      }
    } catch (error) {
      setAberto(false);
      mostrarErro("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        disabled={loading}
        className="text-red-500 hover:text-red-700 font-semibold transition-colors disabled:opacity-50 text-sm"
        title="Excluir"
      >
        {loading ? "..." : "Excluir"}
      </button>
      <ModalConfirmacao
        aberto={aberto}
        titulo="Excluir item?"
        texto="Este item será removido. Esta ação não pode ser desfeita."
        confirmarLabel="Confirmar exclusão"
        carregando={loading}
        onCancelar={() => setAberto(false)}
        onConfirmar={handleDelete}
      />
    </>
  );
}