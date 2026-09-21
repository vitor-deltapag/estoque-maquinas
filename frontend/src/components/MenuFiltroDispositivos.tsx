"use client";

import { useEffect, useState } from "react";
import {
  contarFiltros,
  FILTRO_VAZIO,
  OPCOES_FILTRO_AQUISICAO,
  OPCOES_FILTRO_ESTADO,
  OPCOES_FILTRO_EVENTO,
  OPCOES_FILTRO_MODELO,
  OPCOES_FILTRO_PARCEIRO,
  type FiltroMaquinas,
} from "../lib/filtroDispositivos";

function GrupoOpcoes({
  titulo,
  valor,
  opcoes,
  onChange,
}: {
  titulo: string;
  valor: string;
  opcoes: { value: string; label: string }[];
  onChange: (valor: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map((opt) => {
          const ativo = valor === opt.value;
          return (
            <button
              key={opt.value || "todos"}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                ativo
                  ? "bg-orange-600 border-orange-600 text-white"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-orange-500 hover:border-orange-500 hover:text-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MenuFiltroDispositivos({
  filtros,
  onAplicar,
}: {
  filtros: FiltroMaquinas;
  onAplicar: (filtros: FiltroMaquinas) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<FiltroMaquinas>(filtros);
  const ativos = contarFiltros(filtros);

  useEffect(() => {
    if (aberto) setRascunho(filtros);
  }, [aberto, filtros]);

  function alterar(campo: keyof FiltroMaquinas, valor: string) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }));
  }

  function aplicar(proximo: FiltroMaquinas) {
    onAplicar(proximo);
    setAberto(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`w-full md:w-auto min-w-[140px] py-3 px-4 rounded-lg border font-semibold text-sm outline-none focus:ring-2 focus:ring-orange-500 transition-colors ${
          ativos
            ? "border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400"
            : "border-gray-300 bg-white text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        }`}
      >
        {ativos ? `Filtros (${ativos})` : "Filtros"}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:bg-gray-900 dark:border-gray-800">
            <div className="space-y-4">
              <GrupoOpcoes
                titulo="Modelo"
                valor={rascunho.modelo}
                opcoes={OPCOES_FILTRO_MODELO}
                onChange={(valor) => alterar("modelo", valor)}
              />
              <GrupoOpcoes
                titulo="Estado"
                valor={rascunho.estado}
                opcoes={OPCOES_FILTRO_ESTADO}
                onChange={(valor) => alterar("estado", valor)}
              />
              <GrupoOpcoes
                titulo="Aquisição"
                valor={rascunho.aquisicao}
                opcoes={OPCOES_FILTRO_AQUISICAO}
                onChange={(valor) => alterar("aquisicao", valor)}
              />
              <GrupoOpcoes
                titulo="Evento"
                valor={rascunho.evento}
                opcoes={OPCOES_FILTRO_EVENTO}
                onChange={(valor) => alterar("evento", valor)}
              />
              <GrupoOpcoes
                titulo="Parceiro"
                valor={rascunho.parceiro}
                opcoes={OPCOES_FILTRO_PARCEIRO}
                onChange={(valor) => alterar("parceiro", valor)}
              />
            </div>
            <div className="flex justify-between gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => aplicar(FILTRO_VAZIO)}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:hover:text-gray-900"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => aplicar(rascunho)}
                className="px-4 py-2 text-sm rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700"
              >
                Aplicar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
