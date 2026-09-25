"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  VINCULO_CLIENTE: "Vinculou",
  DESVINCULO_CLIENTE: "Desvinculou",
  ENTRADA_EVENTO: "Entrou em evento",
  SAIDA_EVENTO: "Saiu do evento",
  EXCLUSAO: "Excluiu a máquina",
};

function quandoTexto(iso: string) {
  if (!iso) return "";
  const dia = new Date(iso);
  if (Number.isNaN(dia.getTime())) return iso;
  return dia.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function linhaRegistro(item: any) {
  return `${quandoTexto(item.quando)} · ${item.usuario_nome || "Usuário não identificado"} · ${ROTULO[item.tipo] || item.tipo} · ${item.numero_serial}${item.cliente_nome ? ` · ${item.cliente_nome}` : ""}`;
}

function baixarRegistros(resumo: any) {
  const logs = resumo?.logs || [];
  const corpo = [
    `Registros da semana ${resumo?.inicio || ""} a ${resumo?.fim || ""}`,
    "",
    ...(logs.length ? logs.map(linhaRegistro) : ["Nenhum registro nesta semana."]),
    "",
  ].join("\n");
  const arquivo = new Blob([corpo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = `movimentacoes-${resumo?.inicio || "semana"}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MovimentacoesPage() {
  const router = useRouter();
  const [podeBaixar, setPodeBaixar] = useState(false);
  const [semana, setSemana] = useState(segundaDe(new Date().toISOString().slice(0, 10)));
  const [resumo, setResumo] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [buscaSerial, setBuscaSerial] = useState("");
  const [termoBuscaReal, setTermoBuscaReal] = useState("");
  const [ficha, setFicha] = useState<any>(null);
  const [erroSerial, setErroSerial] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [clienteAberto, setClienteAberto] = useState<any>(null);
  const [registrosAbertos, setRegistrosAbertos] = useState(false);

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
    apiFetch("/usuarios/me", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const me = await res.json();
        if (!me.permissoes?.ver_movimentacoes) {
          router.replace("/");
          return;
        }
        setPodeBaixar(Boolean(me.permissoes?.baixar_movimentacoes));
      })
      .catch(console.error);
  }, [router]);

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
        Registro de quem vinculou, desvinculou ou excluiu cada máquina. O saldo da semana continua separado.
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
          {ficha.excluida && (
            <p className="text-sm text-red-600 mt-2">Esta máquina foi excluída. O serial permanece no histórico.</p>
          )}
          {(ficha.logs || []).length > 0 && (
            <ul className="mt-3 text-sm text-gray-800 dark:text-gray-200">
              {ficha.logs.map((item: any, indice: number) => (
                <li key={`${item.quando}-${item.tipo}-${indice}`}>
                  {quandoTexto(item.quando)} · {item.usuario_nome || "Usuário não identificado"} · {ROTULO[item.tipo] || item.tipo} · {item.numero_serial}
                  {item.cliente_nome ? ` · ${item.cliente_nome}` : ""}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3">Últimos 3 vínculos</p>
          {(ficha.ultimos_vinculos || []).length === 0 && (
            <p className="text-sm text-gray-500">Nenhum vínculo registrado.</p>
          )}
          <ul className="mt-1 text-sm text-gray-800 dark:text-gray-200">
            {(ficha.ultimos_vinculos || []).map((item: any, indice: number) => (
              <li key={`${item.quando}-${item.mid}-${indice}`}>
                {quandoTexto(item.quando)} · {item.usuario_nome || "Usuário não identificado"} · {item.cliente_nome || "Cliente removido"} · MID {item.mid || "sem MID"}
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
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Na semana: vínculos novos {resumo.totais.vinculos_novos} · desvínculos {resumo.totais.desvinculos} · trocas {resumo.totais.trocas}
        </p>
      )}

      <button
        type="button"
        onClick={() => setRegistrosAbertos(true)}
        className="mb-8 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm"
      >
        Registros da semana
      </button>

      {carregando && <p className="text-orange-600 font-medium animate-pulse">Carregando resumo...</p>}

      {!carregando && (resumo?.clientes || []).length === 0 && (
        <p className="text-gray-500">Nenhuma movimentação nesta semana.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(resumo?.clientes || []).map((cliente: any) => {
          const clienteBloco = (cliente.blocos || []).find((bloco: any) => bloco.bloco === "cliente");
          return (
            <button
              key={cliente.cliente_id}
              type="button"
              onClick={() => setClienteAberto(cliente)}
              className="text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-orange-500 rounded-xl p-5 shadow-sm"
            >
              <h2 className="font-bold text-lg text-gray-900 dark:text-white truncate">{cliente.cliente_nome || "Cliente removido"}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Vínculos novos {clienteBloco?.vinculos_novos || 0} · Desvínculos {clienteBloco?.desvinculos || 0} · Trocas {clienteBloco?.trocas || 0}
              </p>
              <p className="mt-4 text-xs font-bold text-orange-600">Ver detalhes →</p>
            </button>
          );
        })}
      </div>

      {clienteAberto && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
          <div className="flex min-h-full items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 w-full max-w-lg p-8 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{clienteAberto.cliente_nome || "Cliente removido"}</h2>
                <button type="button" onClick={() => setClienteAberto(null)} className="text-red-400 hover:text-red-600 text-xl font-bold bg-red-100 h-8 w-8 rounded-full">✕</button>
              </div>
              {(clienteAberto.blocos || []).map((bloco: any) => (
                <div key={bloco.bloco} className="mb-5">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {bloco.bloco === "cliente" ? "Cliente" : "Evento"}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Trocas {bloco.trocas} · Vínculos novos {bloco.vinculos_novos} · Desvínculos {bloco.desvinculos}
                  </p>
                  <ul className="mt-2 text-sm text-gray-800 dark:text-gray-200">
                    {(bloco.detalhe || []).map((item: any) => (
                      <li key={`${item.numero_serial}-${item.situacao}`}>{item.numero_serial} · {ROTULO[item.situacao] || item.situacao}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {registrosAbertos && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
          <div className="flex min-h-full items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 w-full max-w-2xl p-8 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6 gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Registros da semana</h2>
                  <p className="text-xs text-gray-500 mt-1">{resumo ? `${resumo.inicio} a ${resumo.fim}` : semana}</p>
                </div>
                <button type="button" onClick={() => setRegistrosAbertos(false)} className="text-red-400 hover:text-red-600 text-xl font-bold bg-red-100 h-8 w-8 rounded-full">✕</button>
              </div>
              {(resumo?.logs || []).length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum registro nesta semana.</p>
              ) : (
                <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-2">
                  {resumo.logs.map((item: any, indice: number) => (
                    <li key={`${item.quando}-${item.numero_serial}-${item.tipo}-${indice}`} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                      {linhaRegistro(item)}
                    </li>
                  ))}
                </ul>
              )}
              {podeBaixar && (
              <button
                type="button"
                onClick={() => baixarRegistros(resumo)}
                className="mt-6 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm"
              >
                Baixar TXT
              </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
