"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

function segundaDe(iso: string) {
  const dia = new Date(`${iso}T12:00:00`);
  dia.setDate(dia.getDate() - ((dia.getDay() + 6) % 7));
  return dia.toISOString().slice(0, 10);
}

function somarDias(iso: string, dias: number) {
  const dia = new Date(`${iso}T12:00:00`);
  dia.setDate(dia.getDate() + dias);
  return dia.toISOString().slice(0, 10);
}

const ROTULO: Record<string, string> = {
  nao_alterou: "Não alterou o saldo",
  troca_saida: "Troca (saiu)",
  troca_entrada: "Troca (entrou)",
  desvinculo: "Desvínculo",
  vinculo_novo: "Vínculo novo",
};

export default function MovimentacoesPage() {
  const [semana, setSemana] = useState(segundaDe(new Date().toISOString().slice(0, 10)));
  const [resumo, setResumo] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    apiFetch(`/movimentacoes/resumo?semana=${semana}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setResumo)
      .catch(console.error)
      .finally(() => setCarregando(false));
  }, [semana]);

  return (
    <main className="p-10 max-w-7xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <h1 className="text-3xl font-bold text-orange-600">Movimentações</h1>
      <p className="text-sm text-gray-500 mt-1 font-medium">
        Trocas, vínculos novos e desvínculos da semana. A mesma máquina que entra e sai não altera o saldo.
      </p>
      <div className="flex flex-wrap items-center gap-3 my-6">
        <button
          type="button"
          onClick={() => setSemana(somarDias(semana, -7))}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200"
        >
          Semana anterior
        </button>
        <span className="font-semibold text-gray-900 dark:text-white">
          {resumo ? `${resumo.inicio} a ${resumo.fim}` : semana}
        </span>
        <button
          type="button"
          onClick={() => setSemana(somarDias(semana, 7))}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200"
        >
          Próxima semana
        </button>
      </div>

      {carregando && <p className="text-orange-600 font-medium animate-pulse">Carregando resumo...</p>}

      {!carregando && (resumo?.clientes || []).length === 0 && (
        <p className="text-gray-500">Nenhuma movimentação nesta semana.</p>
      )}

      {(resumo?.clientes || []).map((cliente: any) => (
        <section key={cliente.cliente_id} className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">{cliente.cliente_nome}</h2>
          {cliente.blocos.map((bloco: any) => (
            <div key={bloco.bloco} className="mt-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {bloco.bloco === "cliente" ? "Cliente" : "Evento"}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Trocas {bloco.trocas} · Vínculos novos {bloco.vinculos_novos} · Desvínculos {bloco.desvinculos}
              </p>
              <ul className="mt-2 text-sm text-gray-800 dark:text-gray-200">
                {bloco.detalhe.map((item: any) => (
                  <li key={`${item.numero_serial}-${item.situacao}`}>
                    {item.numero_serial} · {ROTULO[item.situacao] || item.situacao}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
