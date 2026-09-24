"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { useMensagem } from "../../components/ToastErro";
import { classeMostradorEstado, classeMostradorModelo, modeloDoLote } from "../../lib/modeloSerial";
import { OPCOES_AQUISICAO } from "../../lib/aquisicao";


function serialLimpo(valor: string) {
  return valor.trim().toUpperCase();
}

function seriaisDoFormulario(atual: string[], digitado: string) {
  const vistos = new Set(atual);
  const proximo = [...atual];
  for (const serial of digitado.split(/[\n,;]+/).map(serialLimpo).filter(Boolean)) {
    if (vistos.has(serial)) continue;
    vistos.add(serial);
    proximo.push(serial);
  }
  return proximo;
}

// ============================================================================
// 1. COMPONENTE AUXILIAR: DROPDOWN CUSTOMIZADO COM HOVER LARANJA
// ============================================================================
interface Option {
  value: string;
  label: string;
}

interface DropdownProps {
  name: string;
  value: string;
  options: Option[];
  placeholder: string;
  onChange: (name: string, value: string) => void;
}

function DropdownCustomizado({ name, value, options, placeholder, onChange }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (optionValue: string) => {
    onChange(name, optionValue);
    setIsOpen(false);
  };

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div className="relative w-full font-sans">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-orange-500 outline-none flex justify-between items-center text-left dark:bg-gray-900 dark:border-gray-700 transition-colors"
      >
        <span className={value ? "text-gray-900 dark:text-white" : "text-gray-500"}>{selectedLabel}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Overlay invisível para fechar o dropdown ao clicar fora */}
          <div className="fixed inset-0 z-0" onClick={() => setIsOpen(false)}></div>

          <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto dark:bg-gray-900 dark:border-gray-800 transition-colors">
            {placeholder ? (
              <li
                onClick={() => handleSelect("")}
                className="p-2.5 text-gray-500 cursor-pointer hover:bg-orange-500 hover:text-white transition-colors text-sm"
              >
                {placeholder}
              </li>
            ) : null}
            {options.map((opt) => (
              <li
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className="p-2.5 text-black cursor-pointer hover:bg-orange-500 hover:text-white transition-colors text-sm font-medium dark:text-white"
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
// ============================================================================


export default function NovoDispositivo() {
  const router = useRouter();

  const [adquirentes, setAdquirentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useMensagem();

  const [formData, setFormData] = useState({
    mid: "", fornecedor_nome: "", adquirente_nome: "", aquisicao: ""
  });
  const [buscaSerial, setBuscaSerial] = useState("");
  const [seriais, setSeriais] = useState<string[]>([]);
  const [isParceiro, setIsParceiro] = useState(false);
  const [nomeClienteVisual, setNomeClienteVisual] = useState("");
  const [clienteInativo, setClienteInativo] = useState(false);
  const listaSeriaisAtual = seriaisDoFormulario(seriais, buscaSerial);
  const { modelo: modeloInferido, conflito: conflitoModelo } = modeloDoLote(listaSeriaisAtual);
  const estadoInferido = formData.mid.trim() ? "NO CLIENTE" : "ESTOQUE";

  useEffect(() => {
    async function carregarDados() {
      try {
        const resAdquirentes = await apiFetch(`/clientes?parceiro=true&limit=500`);
        if (resAdquirentes.ok) setAdquirentes(await resAdquirentes.json());
      } catch (error) {
        console.error("Erro ao carregar os dados:", error);
      }
    }
    carregarDados();
  }, []);

  useEffect(() => {
    const midDigitado = formData.mid.trim();
    if (!midDigitado) {
      setNomeClienteVisual("");
      setClienteInativo(false);
      setFormData(prev => (prev.fornecedor_nome ? { ...prev, fornecedor_nome: "" } : prev));
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(`/clientes?search=${encodeURIComponent(midDigitado)}`, { signal: ac.signal });
        if (!response.ok) return;
        const dados = await response.json();
        const encontrado = dados.find((c: any) => c.mid === midDigitado);
        if (encontrado) {
          const inativo = Boolean(encontrado.status) && encontrado.status.toUpperCase() !== "ATIVO";
          setClienteInativo(inativo);
          setNomeClienteVisual(
            inativo
              ? `⚠️ ${encontrado.nome} está inativo na Movingpay`
              : `${encontrado.nome} (${encontrado.nome_fantasia || "Sem Nome Fantasia"})`
          );
          setFormData(prev => (
            prev.fornecedor_nome === (encontrado.distribuidor_nome || "")
              ? prev
              : { ...prev, fornecedor_nome: encontrado.distribuidor_nome || "" }
          ));
        } else {
          setClienteInativo(false);
          setNomeClienteVisual("⚠️ MID não localizado no sistema");
          setFormData(prev => (prev.fornecedor_nome ? { ...prev, fornecedor_nome: "" } : prev));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Erro ao validar o MID:", error);
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [formData.mid]);

  // Função original para inputs normais
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 2. NOVA FUNÇÃO: Para lidar com a mudança dos dropdowns customizados
  const handleDropdownChange = (name: string, value: string) => {
    if (name === "isParceiro") {
      const sim = value === "sim";
      setIsParceiro(sim);
      if (!sim) setFormData({ ...formData, adquirente_nome: "" });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const adicionarEmLote = () => {
    const pedacos = buscaSerial.split(/[\n,;]+/).map(serialLimpo).filter(Boolean);
    if (!pedacos.length) return;
    setSeriais((atual) => seriaisDoFormulario(atual, buscaSerial));
    setBuscaSerial("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const listaSeriais = seriaisDoFormulario(seriais, buscaSerial);
    if (listaSeriais.length === 0) {
      setMensagem({ tipo: "erro", texto: "Informe ao menos um número serial." });
      return;
    }
    if (conflitoModelo) {
      setMensagem({ tipo: "erro", texto: "Todos os seriais do lote precisam ser do mesmo modelo." });
      return;
    }
    if (!modeloInferido) {
      setMensagem({ tipo: "erro", texto: "Serial não corresponde a um modelo conhecido." });
      return;
    }
    if (isParceiro && !formData.adquirente_nome) {
      setMensagem({ tipo: "erro", texto: "Selecione o parceiro ou desmarque a opção." });
      return;
    }
    if (formData.mid.trim() && clienteInativo) {
      setMensagem({ tipo: "erro", texto: "Cliente inativo na Movingpay. Não é possível vincular uma máquina." });
      return;
    }
    if (!formData.aquisicao) {
      setMensagem({ tipo: "erro", texto: "Informe se a máquina é comprada ou alugada." });
      return;
    }
    setLoading(true);

    const payload = {
      modelo: modeloInferido,
      estado: estadoInferido,
      aquisicao: formData.aquisicao,
      mid: formData.mid || null,
      fornecedor_nome: formData.fornecedor_nome || null,
      adquirente_nome: isParceiro ? (formData.adquirente_nome || null) : null,
      numero_seriais: listaSeriais,
    };

    try {
      const response = await apiFetch(`/dispositivos/lote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const criado = await response.json();
        const qtd = criado.qtd || listaSeriais.length;
        setMensagem({
          tipo: "sucesso",
          texto: qtd === 1 ? "Dispositivo cadastrado com sucesso!" : `${qtd} dispositivos cadastrados com sucesso!`,
        });
        setTimeout(() => router.push("/dispositivos"), 1500);
      } else {
        const dadosErro = await response.json();
        const detalhe = dadosErro.detail;
        setMensagem({
          tipo: "erro",
          texto: typeof detalhe === "string" ? detalhe : "Erro ao cadastrar.",
        });
      }
    } catch (error) {
      setMensagem({ tipo: "erro", texto: "Erro de conexão." });
    } finally {
      setLoading(false);
    }
  };

  const qtdParaSalvar = seriaisDoFormulario(seriais, buscaSerial).length;

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 dark:bg-gray-950 transition-colors">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md border border-gray-100 p-8 dark:bg-gray-900 transition-colors">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 dark:text-gray-100 transition-colors">Cadastrar Dispositivo</h1>
        <p className="text-sm text-gray-500 mb-6">
          Um ou vários seriais. Modelo, estado, aquisição, MID, fornecedor e parceiro valem para todas as máquinas do lote.
        </p>

        {mensagem.texto && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${mensagem.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Número serial *</label>
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
                className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-medium focus:ring-2 focus:ring-orange-500 outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors"
              />
              <button
                type="button"
                onClick={adicionarEmLote}
                className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 rounded-lg text-sm"
              >
                Adicionar
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {seriais.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma máquina na lista. Um serial também pode ir direto no Salvar.</p>
              ) : (
                seriais.map((serial) => (
                  <button
                    key={serial}
                    type="button"
                    onClick={() => setSeriais((atual) => atual.filter((item) => item !== serial))}
                    className="text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 py-1 px-2.5 rounded-md"
                  >
                    {serial} ✕
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Modelo</label>
            <p className={classeMostradorModelo(modeloInferido, conflitoModelo)}>
              {conflitoModelo ? "Seriais de modelos diferentes" : modeloInferido || "—"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Definido pelo número serial. Não é possível alterar.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Distribuidor</label>
            <p className="w-full border border-gray-200 rounded-lg p-2.5 text-black font-semibold bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              {formData.fornecedor_nome || "—"}
            </p>
            <p className="mt-1 text-xs text-gray-500">Acompanha o MID do cliente. Não é possível alterar.</p>
          </div>

          <hr className="border-gray-200 dark:border-gray-800 transition-colors" />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Digitar MID do Cliente</label>
            <input type="text" name="mid" value={formData.mid} onChange={handleChange} placeholder="Digite o MID para vincular o cliente..." className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-black font-medium focus:ring-2 focus:ring-orange-500 outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-white transition-colors" />
            {nomeClienteVisual && (
              <p className={`mt-2 text-xs font-semibold ${nomeClienteVisual.includes('⚠️') ? 'text-amber-600' : 'text-orange-600 bg-orange-50 py-1 px-2.5 rounded-md inline-block'}`}>
                {nomeClienteVisual}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Estado atual</label>
            <p className={classeMostradorEstado(estadoInferido)}>
              {estadoInferido}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Sem MID fica em estoque. Com MID fica no cliente. Reparo e máquina perdida ficam na ficha da máquina.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Aquisição *</label>
            <DropdownCustomizado
              name="aquisicao"
              value={formData.aquisicao}
              onChange={handleDropdownChange}
              placeholder="Selecione..."
              options={OPCOES_AQUISICAO}
            />
            <p className="mt-1 text-xs text-gray-500">
              As máquinas já cadastradas são alugadas. Nas novas, escolha comprada ou alugada.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Máquina de parceiro</label>
              <DropdownCustomizado
                name="isParceiro"
                value={isParceiro ? "sim" : "nao"}
                onChange={handleDropdownChange}
                placeholder=""
                options={[
                  { value: "nao", label: "Não" },
                  { value: "sim", label: "Sim" },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Em evento</label>
              <p className="w-full border border-gray-200 rounded-lg p-2.5 text-gray-900 font-medium bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                Não
              </p>
              <p className="mt-1 text-xs text-gray-500">A máquina entra em evento pela aba Eventos.</p>
            </div>
            {isParceiro && (
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300 transition-colors">Parceiro</label>
                {adquirentes.length === 0 ? (
                  <p className="text-sm text-amber-600">Nenhum cliente marcado como parceiro. Abra o cliente e escolha Parceiro: Sim.</p>
                ) : (
                  <DropdownCustomizado
                    name="adquirente_nome"
                    value={formData.adquirente_nome}
                    onChange={handleDropdownChange}
                    placeholder="Selecione o parceiro..."
                    options={adquirentes.filter((a: any) => a.nome).map((a: any) => ({ value: a.nome, label: a.nome }))}
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <Link href="/dispositivos" className="w-1/2 text-center border border-gray-300 hover:bg-gray-100 hover:text-gray-900 text-gray-700 font-semibold p-2.5 rounded-lg transition-colors text-sm dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-900">Cancelar</Link>
            <button type="submit" disabled={loading} className="w-1/2 bg-orange-600 hover:bg-orange-700 text-white font-semibold p-2.5 rounded-lg transition-colors text-sm disabled:opacity-50">
              {loading ? "Salvando..." : qtdParaSalvar > 1 ? `Salvar ${qtdParaSalvar} máquinas` : "Salvar Dispositivo"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}