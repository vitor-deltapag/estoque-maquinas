"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

function formatarData(valor?: string | null) {
  if (!valor) return "—";
  const [ano, mes, dia] = valor.split("T")[0].split("-");
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

function passouDeSeteDias(valor?: string | null) {
  if (!valor) return false;
  const dia = new Date(valor);
  if (Number.isNaN(dia.getTime())) return false;
  const limite = new Date();
  limite.setDate(limite.getDate() - 7);
  return dia < limite;
}

function recente(ev: { created_at?: string; id?: number }) {
  const marca = ev.created_at ? new Date(ev.created_at).getTime() : 0;
  return Number.isNaN(marca) ? ev.id || 0 : marca;
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

export default function ListaEventos() {
  const [eventos, setEventos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [consultaFinalizados, setConsultaFinalizados] = useState(false);

  useEffect(() => {
    async function carregar() {
      try {
        const res = await apiFetch("/eventos", { cache: "no-store" });
        if (res.ok) {
          const dados = await res.json();
          const lista = Array.isArray(dados) ? dados : [];
          lista.sort((a: any, b: any) => recente(b) - recente(a));
          setEventos(lista);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  if (carregando) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center transition-colors">
        <p className="text-orange-600 font-medium text-lg animate-pulse">Carregando eventos...</p>
      </main>
    );
  }

  const finalizados = eventos.filter((ev) => ev.situacao === "FINALIZADO");
  const visiveis = consultaFinalizados
    ? finalizados
    : eventos.filter((ev) => ev.situacao !== "FINALIZADO" || !passouDeSeteDias(ev.data_finalizacao || ev.data_fim));
  const pendentes = consultaFinalizados ? [] : visiveis.filter((ev) => ev.situacao === "PENDENTE");

  return (
    <main className="p-10 max-w-7xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-orange-600">Eventos</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Vincule várias máquinas ao mesmo cliente, acompanhe as datas e cobre a devolução.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setConsultaFinalizados((atual) => !atual)}
            className="w-full md:w-auto text-center border border-orange-500 text-orange-700 dark:text-orange-300 font-semibold py-2.5 px-5 rounded-lg text-sm transition-colors"
          >
            {consultaFinalizados ? "Voltar aos eventos" : "Eventos finalizados"}
          </button>
          <Link
            href="/eventos/novo"
            className="w-full md:w-auto text-center bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm shadow-sm transition-colors"
          >
            + Novo Evento
          </Link>
        </div>
      </div>

      {pendentes.length > 0 && (
        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 p-4">
          <p className="font-bold text-red-700 dark:text-red-300">
            Pendência de devolução
          </p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            {pendentes.length === 1
              ? "1 evento já terminou e ainda tem máquinas para cobrar a devolução."
              : `${pendentes.length} eventos já terminaram e ainda têm máquinas para cobrar a devolução.`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visiveis.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 font-medium bg-white rounded-xl border border-dashed border-gray-300 dark:bg-gray-900 dark:border-gray-700">
            {consultaFinalizados ? "Nenhum evento finalizado." : "Nenhum evento em andamento."}
          </div>
        ) : (
          visiveis.map((ev) => (
            <Link
              key={ev.id}
              href={`/eventos/${ev.id}`}
              className="bg-white border border-gray-200 hover:border-orange-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group dark:bg-gray-900 dark:border-gray-800"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <span className={`text-xs font-bold py-1 px-2.5 rounded-md ${badgeSituacao(ev.situacao)}`}>
                    {ev.situacao}
                  </span>
                  <span className="text-xs font-bold text-gray-500">
                    {ev.qtd_maquinas} máquina{ev.qtd_maquinas === 1 ? "" : "s"}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 truncate dark:text-white">
                  {ev.nome || "Evento sem nome"}
                </h3>
                <p className="text-sm font-bold text-gray-400 mt-1 truncate">
                  MID: {ev.cliente_rel?.mid || "—"} · {ev.cliente_rel?.nome || "Cliente"}
                </p>
                <p className="text-sm text-gray-500 mt-3">
                  {formatarData(ev.data_inicio)} até {formatarData(ev.data_fim)}
                </p>
              </div>
              <div className="mt-5 border-t pt-3 flex justify-end text-xs text-gray-400 font-medium">
                <span className="text-orange-600 font-bold group-hover:translate-x-1 transition-transform">
                  Abrir evento →
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
