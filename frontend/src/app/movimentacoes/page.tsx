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

function quandoTexto(iso: string) {
  if (!iso) return "";
  const dia = new Date(iso);
  if (Number.isNaN(dia.getTime())) return iso;
  return dia.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function MovimentacoesPage() {
  const [semana, setSemana] = useState(segundaDe(new Date().toISOString().slice(0, 10)));
  const [resumo, setResumo] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [buscaSerial, setBuscaSerial] = useState("");
  const [termoBuscaReal, setTermoBuscaReal] = useState("");
  const [ficha, setFicha] = useState<any>(null);
  const [erroSerial, setErroSerial] = useState("");
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTermoBuscaReal(buscaSerial), 500);
    return () => clearTimeout(timer);
  }, [buscaSerial]);

  useEffect(() => {
    const termo = termoBuscaReal.trim();
    if (!termo) {
      setFicha(null);
      setErroSerial("");
      setBuscando(false);
      return;
    }
    const ac = new AbortController();
    setBuscando(true);
    setErroSerial("");
    apiFetch(`/movimentacoes/maquina?serial=${encodeURIComponent(termo)}`, { signal: ac.signal })
      .then(async (res) => {
        if (ac.signal.aborted) return;
        if (res.ok) {
          setFicha(await res.json());
          return;
        }
        setFicha(null);
        const corpo = await res.json().catch(() => null);
        setErroSerial(typeof corpo?.detail === "string" ? corpo.detail : "Não foi possível buscar o serial.");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error(error);
        setFicha(null);
        setErroSerial("Não foi possível buscar o serial.");
      })
      .finally(() => {
        if (!ac.signal.aborted) setBuscando(false);
      });
    return () => ac.abort();
  }, [termoBuscaReal]);

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

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mt-6 mb-8 relative dark:bg-gray-900 dark:border-gray-800 transition-colors">
        <div className="relative">
          <input
            type="text"
            value={buscaSerial}
            onChange={(e) => setBuscaSerial(e.target.value)}
            placeholder="Digite o número serial da máquina..."
            className="w-full bg-gray-50 border border-gray-300 rounded-lg py-3 px-4 pl-24 text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder-gray-400 dark:bg-gray-950 dark:border-gray-700 dark:text-white dark:focus:bg-gray-950"
          />
          <span className="absolute left-4 top-3.5 text-gray-500 font-bold text-sm font-mono pointer-events-none">BUSCA:</span>
          {buscando && (
            <div className="absolute right-4 top-3.5 flex space-x-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-150"></div>
            </div>
          )}
        </div>
      </div>
      {erroSerial && <p className="text-sm text-red-600 mb-4">{erroSerial}</p>}
      {ficha && (
        <section className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">{ficha.numero_serial}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {ficha.modelo || "Sem modelo"} · {ficha.estado || "Sem estado"} · {ficha.aquisicao || "Sem aquisição"}
            {ficha.em_evento ? " · Em evento" : ""}
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-200 mt-2">
            Cliente atual: {ficha.cliente_atual ? `${ficha.cliente_atual.nome} · MID ${ficha.cliente_atual.mid || "sem MID"}` : "Nenhum"}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Fornecedor: {ficha.fornecedor_nome || "Nenhum"} · Parceiro: {ficha.adquirente_nome || "Nenhum"}
          </p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3">Últimos 3 vínculos</p>
          {(ficha.ultimos_vinculos || []).length === 0 && (
            <p className="text-sm text-gray-500">Nenhum vínculo registrado.</p>
          )}
          <ul className="mt-1 text-sm text-gray-800 dark:text-gray-200">
            {(ficha.ultimos_vinculos || []).map((item: any, indice: number) => (
              <li key={`${item.quando}-${item.mid}-${indice}`}>
                {quandoTexto(item.quando)} · {item.cliente_nome || "Cliente removido"} · MID {item.mid || "sem MID"}
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {resumo?.totais && (
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-6">
          Na semana: vínculos novos {resumo.totais.vinculos_novos} · desvínculos {resumo.totais.desvinculos} · trocas {resumo.totais.trocas}
        </p>
      )}

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
