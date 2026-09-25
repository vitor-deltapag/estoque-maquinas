"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { usePodeAlterar } from "../../../lib/usePodeAlterar";
import { useMensagem } from "../../../components/ToastErro";

function formatarData(valor?: string | null) {
  if (!valor) return "—";
  const [ano, mes, dia] = valor.split("T")[0].split("-");
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

function badgeSituacao(situacao: string) {
  if (situacao === "PENDENTE") {
    return "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40";
  }
  if (situacao === "FINALIZADO") {
    return "text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800";
  }
  return "text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/40";
}

export default function DetalheEvento() {
  const params = useParams();
  const itemId = params.id;
  const [evento, setEvento] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [mensagem, setMensagem] = useMensagem();
  const { podeAlterar } = usePodeAlterar();

  useEffect(() => {
    async function carregar() {
      try {
        const res = await apiFetch(`/eventos/${itemId}`, { cache: "no-store" });
        if (res.ok) setEvento(await res.json());
      } catch (error) {
        console.error(error);
      } finally {
        setCarregando(false);
      }
    }
    if (itemId) carregar();
  }, [itemId]);

  const handleFinalizar = async () => {
    setFinalizando(true);
    setMensagem({ tipo: "", texto: "" });
    try {
      const res = await apiFetch(`/eventos/${itemId}/finalizar`, { method: "POST" });
      if (res.ok) {
        setEvento(await res.json());
        setConfirmar(false);
        setMensagem({ tipo: "sucesso", texto: "Evento finalizado. As máquinas saíram de evento." });
      } else {
        const erro = await res.json();
        setMensagem({ tipo: "erro", texto: erro.detail || "Não foi possível finalizar o evento." });
      }
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão com o servidor." });
    } finally {
      setFinalizando(false);
    }
  };

  if (carregando) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center transition-colors">
        <p className="text-orange-600 font-medium text-lg animate-pulse">Carregando evento...</p>
      </main>
    );
  }

  if (!evento) {
    return (
      <main className="p-10 max-w-3xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-600 dark:text-gray-300">Evento não encontrado.</p>
        <Link href="/eventos" className="text-orange-600 font-semibold mt-4 inline-block">← Voltar</Link>
      </main>
    );
  }

  return (
    <main className="p-10 max-w-4xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Link href="/eventos" className="text-sm font-semibold text-orange-600 mb-4 inline-block">← Eventos</Link>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <span className={`text-xs font-bold py-1 px-2.5 rounded-md ${badgeSituacao(evento.situacao)}`}>
              {evento.situacao}
            </span>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-3">
              {evento.nome || "Evento sem nome"}
            </h1>
            <p className="text-gray-500 mt-1">
              MID {evento.cliente_rel?.mid || "—"} · {evento.cliente_rel?.nome || "Cliente"}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {formatarData(evento.data_inicio)} até {formatarData(evento.data_fim)}
            </p>
          </div>
          {podeAlterar && evento.status !== "FINALIZADO" && (
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm"
            >
              Finalizar evento
            </button>
          )}
        </div>

        {evento.situacao === "PENDENTE" && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 p-4">
            <p className="font-bold text-red-700 dark:text-red-300">Pendência de devolução</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              A data do evento já passou. Cobre a devolução das {evento.qtd_maquinas} máquina{evento.qtd_maquinas === 1 ? "" : "s"} antes de finalizar.
            </p>
          </div>
        )}

        {mensagem.texto && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {mensagem.texto}
          </div>
        )}

        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">
          Máquinas vinculadas ({evento.dispositivos?.length || 0})
        </h2>
        <div className="space-y-2">
          {(evento.dispositivos || []).length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma máquina neste evento.</p>
          ) : (
            evento.dispositivos.map((maq: any) => (
              <div
                key={maq.id}
                className="flex justify-between items-center border border-gray-200 dark:border-gray-800 rounded-lg p-3"
              >
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

      {confirmar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg p-8 dark:bg-gray-900 dark:border-gray-800">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Finalizar evento?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
              As {evento.qtd_maquinas} máquina{evento.qtd_maquinas === 1 ? "" : "s"} vinculadas sairão de evento.
              Confirme somente depois de tratar a devolução.
            </p>
            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setConfirmar(false)}
                disabled={finalizando}
                className="w-1/2 border border-gray-300 hover:bg-gray-100 hover:text-gray-900 text-gray-700 font-semibold p-2.5 rounded-lg dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleFinalizar}
                disabled={finalizando}
                className="w-1/2 bg-orange-600 hover:bg-orange-700 text-white font-semibold p-2.5 rounded-lg disabled:opacity-50"
              >
                {finalizando ? "Finalizando..." : "Confirmar finalização"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
