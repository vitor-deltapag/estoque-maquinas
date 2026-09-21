"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { useMensagem } from "../../../components/ToastErro";

function serialLimpo(valor: string) {
  return valor.trim().toUpperCase();
}

export default function NovoEvento() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [mid, setMid] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [buscaSerial, setBuscaSerial] = useState("");
  const [seriais, setSeriais] = useState<string[]>([]);
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useMensagem();
  const [nomeClienteVisual, setNomeClienteVisual] = useState("");

  useEffect(() => {
    if (!mid.trim()) {
      setNomeClienteVisual("");
      return;
    }
    const timerBuscaMid = window.setTimeout(async () => {
      try {
        const response = await apiFetch(`/clientes?search=${encodeURIComponent(mid.trim())}`);
        if (!response.ok) return;
        const dados = await response.json();
        const clienteExato = Array.isArray(dados)
          ? dados.find((c: any) => c.mid === mid.trim())
          : null;
        if (clienteExato) {
          setNomeClienteVisual(`${clienteExato.nome} (${clienteExato.nome_fantasia || "Sem Nome Fantasia"})`);
        } else {
          setNomeClienteVisual("⚠️ MID não localizado no sistema");
        }
      } catch (error) {
        console.error("Erro ao validar o MID no servidor:", error);
      }
    }, 500);
    return () => window.clearTimeout(timerBuscaMid);
  }, [mid]);

  useEffect(() => {
    const termo = buscaSerial.trim();
    if (termo.length < 2) {
      setSugestoes([]);
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiFetch(`/dispositivos?search=${encodeURIComponent(termo)}&limit=10&em_evento=false`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) return;
        const dados = await res.json();
        setSugestoes(Array.isArray(dados) ? dados : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }, 300);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [buscaSerial]);

  const adicionarSerial = (serialBruto: string) => {
    const serial = serialLimpo(serialBruto);
    if (!serial) return;
    setSeriais((atual) => (atual.includes(serial) ? atual : [...atual, serial]));
    setBuscaSerial("");
    setSugestoes([]);
  };

  const adicionarEmLote = () => {
    const pedacos = buscaSerial.split(/[\n,;]+/).map(serialLimpo).filter(Boolean);
    if (!pedacos.length) return;
    setSeriais((atual) => {
      const vistos = new Set(atual);
      const proximo = [...atual];
      for (const serial of pedacos) {
        if (vistos.has(serial)) continue;
        vistos.add(serial);
        proximo.push(serial);
      }
      return proximo;
    });
    setBuscaSerial("");
    setSugestoes([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem({ tipo: "", texto: "" });
    if (!mid.trim() || !dataInicio || !dataFim || seriais.length === 0) {
      setMensagem({ tipo: "erro", texto: "Informe MID, datas e ao menos uma máquina." });
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch("/eventos", {
        method: "POST",
        body: JSON.stringify({
          nome: nome.trim() || null,
          mid: mid.trim(),
          data_inicio: dataInicio,
          data_fim: dataFim,
          numero_seriais: seriais,
        }),
      });
      if (response.ok) {
        const criado = await response.json();
        router.push(`/eventos/${criado.id}`);
        return;
      }
      const erro = await response.json();
      setMensagem({ tipo: "erro", texto: erro.detail || "Não foi possível criar o evento." });
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão com o servidor." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 dark:bg-gray-950 transition-colors">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-md border border-gray-100 p-8 dark:bg-gray-900 dark:border-gray-800 transition-colors">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 dark:text-gray-100">Novo Evento</h1>
        <p className="text-sm text-gray-500 mb-6">
          Todas as máquinas entram em evento para o mesmo cliente, com a data de início e término.
        </p>

        {mensagem.texto && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300">Nome do evento</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Feira, congresso, ativação"
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-orange-500 text-black dark:border-gray-700 dark:text-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300">MID do cliente*</label>
            <input
              required
              type="text"
              value={mid}
              onChange={(e) => setMid(e.target.value)}
              placeholder="Digite o MID para vincular o cliente..."
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-orange-500 text-black dark:border-gray-700 dark:text-white dark:bg-gray-900"
            />
            {nomeClienteVisual && (
              <p className={`mt-2 text-xs font-semibold ${nomeClienteVisual.includes("⚠️") ? "text-amber-600" : "text-orange-600 bg-orange-50 py-1 px-2.5 rounded-md inline-block"}`}>
                {nomeClienteVisual}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300">Data do evento*</label>
              <input
                required
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-orange-500 text-black dark:border-gray-700 dark:text-white dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300">Término*</label>
              <input
                required
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-orange-500 text-black dark:border-gray-700 dark:text-white dark:bg-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 dark:text-gray-300">Máquinas em lote*</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={buscaSerial}
                onChange={(e) => setBuscaSerial(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarEmLote();
                  }
                }}
                placeholder="Serial, vários separados por vírgula ou Enter"
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-orange-500 text-black dark:border-gray-700 dark:text-white dark:bg-gray-900"
              />
              <button
                type="button"
                onClick={adicionarEmLote}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 rounded-lg text-sm"
              >
                Adicionar
              </button>
            </div>
            {sugestoes.length > 0 && (
              <ul className="mt-2 border border-gray-200 rounded-lg overflow-hidden dark:border-gray-700">
                {sugestoes.map((maq) => (
                  <li key={maq.id}>
                    <button
                      type="button"
                      onClick={() => adicionarSerial(maq.numero_serial)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-orange-500 hover:text-white dark:text-white"
                    >
                      {maq.numero_serial} {maq.modelo ? `· ${maq.modelo}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {seriais.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma máquina selecionada.</p>
              ) : (
                seriais.map((serial) => (
                  <button
                    key={serial}
                    type="button"
                    onClick={() => setSeriais((atual) => atual.filter((item) => item !== serial))}
                    className="text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 py-1 px-2.5 rounded-md"
                  >
                    {serial} ✕
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <Link href="/eventos" className="w-1/2 text-center border border-gray-300 hover:bg-gray-100 hover:text-gray-900 text-gray-700 font-semibold p-2.5 rounded-lg transition-colors dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-900">
              Cancelar
            </Link>
            <button type="submit" disabled={loading} className="w-1/2 bg-orange-600 hover:bg-orange-700 text-white font-semibold p-2.5 rounded-lg transition-colors">
              {loading ? "Salvando..." : "Criar evento"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
