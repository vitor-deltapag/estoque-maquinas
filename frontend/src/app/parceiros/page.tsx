"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { usePodeAlterar } from "../../lib/usePodeAlterar";

export default function ListaParceiros() {
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { podeAlterar } = usePodeAlterar();

  useEffect(() => {
    async function carregar() {
      try {
        const res = await apiFetch("/parceiros", { cache: "no-store" });
        if (res.ok) {
          const dados = await res.json();
          const lista = Array.isArray(dados) ? dados : [];  
          setParceiros(lista);
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
        <p className="text-orange-600 font-medium text-lg animate-pulse">Carregando parceiros...</p>
      </main>
    );
  }

  return (
    <main className="p-10 max-w-7xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-orange-600">Parceiros</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Cadastre parceiros e veja as máquinas vinculadas. Os seriais só se alteram na aba Máquinas.
          </p>
        </div>
        {podeAlterar && (
        <Link
          href="/parceiros/novo"
          className="w-full md:w-auto text-center bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm shadow-sm transition-colors"
        >
          + Novo Parceiro
        </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {parceiros.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 font-medium bg-white rounded-xl border border-dashed border-gray-300 dark:bg-gray-900 dark:border-gray-700">
            Nenhum parceiro cadastrado.
          </div>
        ) : (
          parceiros.map((parceiro) => (
            <Link
              key={parceiro.id}
              href={`/parceiros/${parceiro.id}`}
              className="bg-white border border-gray-200 hover:border-orange-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group dark:bg-gray-900 dark:border-gray-800"
            >
        <div>
            <div className="flex justify-between items-start gap-2 mb-3">
                <span className="text-xs font-bold text-teal-700 bg-teal-100 dark:text-teal-300 dark:bg-teal-900/40 py-1 px-2.5 rounded-md">
                MID: {parceiro.mid || "S/N"}
                </span>
                <span className="text-xs font-bold text-gray-500">
                    {parceiro.qtd_maquinas} máquina{parceiro.qtd_maquinas === 1 ? "" : "s"}
                </span>
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 truncate dark:text-white">
                {parceiro.nome || "Parceiro sem nome"}
            </h3>
            <p className="text-sm font-bold text-gray-400 mt-1 truncate">
                {parceiro.nome_fantasia || "Sem Nome Fantasia"}
            </p>
            </div>
              <div className="mt-5 border-t pt-3 flex justify-end text-xs text-gray-400 font-medium">
                <span className="text-orange-600 font-bold group-hover:translate-x-1 transition-transform">
                  Abrir parceiro →
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
