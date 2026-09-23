"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { useMensagem } from "../../components/ToastErro";
import { classeCorModelo, classeMostradorEstado, classeMostradorModelo, modeloPorSerial, rotuloEstado } from "../../lib/modeloSerial";
import { classeCorAquisicao, OPCOES_AQUISICAO, rotuloAquisicao } from "../../lib/aquisicao";
import { filtrosDaUrl, queryFiltros } from "../../lib/filtroDispositivos";
import MenuFiltroDispositivos from "../../components/MenuFiltroDispositivos";

// ============================================================================
// COMPONENTE AUXILIAR: DROPDOWN CUSTOMIZADO COM HOVER LARANJA PARA O MODAL
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
        className="w-full bg-white border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-orange-500 outline-none flex justify-between items-center text-left text-sm dark:bg-gray-800 dark:border-gray-700 transition-colors"
      >
        <span className={value ? "text-gray-900 font-medium dark:text-white" : "text-gray-500"}>{selectedLabel}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Overlay para fechar se clicar fora do dropdown, mas mantém o modal aberto */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>

          <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto dark:bg-gray-900 dark:border-gray-800 transition-colors">
            {options.map((opt) => (
              <li
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className="p-2.5 text-gray-900 cursor-pointer hover:bg-orange-500 hover:text-white transition-colors text-sm font-medium dark:text-white"
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

function estadoEspecial(estado: string) {
  return estado === "REPARO" || estado === "MAQUINA PERDIDA";
}

function GerenciamentoDispositivos() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filtrosLista = filtrosDaUrl(searchParams);
  const chaveFiltros = queryFiltros(filtrosLista).toString();

  // Estados do sistema
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [adquirentes, setAdquirentes] = useState<any[]>([]);

  // Estados de Busca e Paginação (Alta Performance)
  const [buscaSerial, setBuscaSerial] = useState("");
  const [termoBuscaReal, setTermoBuscaReal] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [temMaisPaginas, setTemMaisPaginas] = useState(true);
  const LIMITE_POR_PAGINA = 20;

  // Estados de Loading
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [atualizandoLista, setAtualizandoLista] = useState(false);

  // Estados do Modal Detalhado (Pop-up)
  const [modalAberto, setModalAberto] = useState(false);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [loadingExcluir, setLoadingExcluir] = useState(false);
  const [loadingEstado, setLoadingEstado] = useState<"REPARO" | "MAQUINA PERDIDA" | null>(null);
  const [mensagemModal, setMensagemModal] = useMensagem();

  // Dados do formulário interno do Pop-up
  const [formData, setFormData] = useState({
    id: "", modelo: "", numero_serial: "", estado: "", aquisicao: "", mid: "", fornecedor_nome: "", adquirente_nome: ""
  });
  const [isParceiro, setIsParceiro] = useState(false);
  const [isEvento, setIsEvento] = useState(false);
  const [nomeClienteVisual, setNomeClienteVisual] = useState("");
  const modeloDaFicha = modeloPorSerial(formData.numero_serial);

  // 1. CARREGA FORNECEDORES E PARCEIROS 1 VEZ
  useEffect(() => {
    async function carregarDadosBase() {
      try {
        const [resFornecedores, resAdquirentes] = await Promise.all([
          apiFetch(`/fornecedores`),
          apiFetch(`/clientes?parceiro=true&limit=500`),
        ]);
        if (resFornecedores.ok) setFornecedores(await resFornecedores.json());
        if (resAdquirentes.ok) setAdquirentes(await resAdquirentes.json());
      } catch (error) {
        console.error("Erro ao carregar dados base:", error);
      }
    }
    carregarDadosBase();
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
  }, [chaveFiltros]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTermoBuscaReal(buscaSerial);
      setPaginaAtual(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [buscaSerial]);

  // 3. BUSCA MÁQUINAS
  useEffect(() => {
    const ac = new AbortController();
    async function buscarDispositivos() {
      setAtualizandoLista(true);
      try {
        const params = new URLSearchParams({
          page: paginaAtual.toString(),
          limit: LIMITE_POR_PAGINA.toString(),
        });
        if (termoBuscaReal) params.append("search", termoBuscaReal);
        if (filtrosLista.modelo) params.append("modelo", filtrosLista.modelo);
        if (filtrosLista.estado) params.append("estado", filtrosLista.estado);
        if (filtrosLista.aquisicao) params.append("aquisicao", filtrosLista.aquisicao);
        if (filtrosLista.evento) params.append("em_evento", filtrosLista.evento);
        if (filtrosLista.parceiro) params.append("parceiro", filtrosLista.parceiro);
        const response = await apiFetch(`/dispositivos?${params.toString()}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        if (response.ok) {
          const dados = await response.json();
          setDispositivos(Array.isArray(dados) ? dados : []);
          setTemMaisPaginas(dados.length === LIMITE_POR_PAGINA);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Erro ao conectar com a API:", error);
      } finally {
        if (!ac.signal.aborted) {
          setCarregandoInicial(false);
          setAtualizandoLista(false);
        }
      }
    }
    buscarDispositivos();
    return () => ac.abort();
  }, [paginaAtual, termoBuscaReal, filtrosLista.modelo, filtrosLista.estado, filtrosLista.aquisicao, filtrosLista.evento, filtrosLista.parceiro]);

  // 4. ABRE O POP-UP AO CLICAR EM UM CARD
  const handleCardClick = (disp: any) => {
    setFormData({
      id: disp.id,
      modelo: disp.modelo || "",
      numero_serial: (disp.numero_serial || "").toUpperCase(),
      estado: disp.estado || "",
      aquisicao: disp.aquisicao || "",
      mid: disp.cliente_rel?.mid || "",
      fornecedor_nome: disp.fornecedor_rel?.nome || "",
      adquirente_nome: disp.adquirente_rel?.nome || ""
    });
    setIsParceiro(Boolean(disp.adquirente_rel?.nome));
    setIsEvento(Boolean(disp.em_evento));
    setMensagemModal({ tipo: "", texto: "" });
    setModalAberto(true);
  };

  // VALIDAÇÃO INTELIGENTE DE MID NO SERVIDOR
  useEffect(() => {
    if (!formData.mid) {
      setNomeClienteVisual("");
      setFormData(prev => (
        estadoEspecial(prev.estado) || prev.estado === "ESTOQUE"
          ? prev
          : { ...prev, estado: "ESTOQUE" }
      ));
      return;
    }

    const timerBuscaMid = setTimeout(async () => {
      try {
        const response = await apiFetch(`/clientes?search=${formData.mid.trim()}`);
        if (response.ok) {
          const dados = await response.json();
          const clienteExato = dados.find((c: any) => c.mid === formData.mid.trim());

          if (clienteExato) {
            setNomeClienteVisual(`✅ ${clienteExato.nome}`);
            setFormData(prev => (
              estadoEspecial(prev.estado) || prev.estado === "NO CLIENTE"
                ? prev
                : { ...prev, estado: "NO CLIENTE" }
            ));
          } else {
            setNomeClienteVisual("⚠️ MID não cadastrado no sistema");
          }
        }
      } catch (error) {
        console.error("Erro ao validar o MID no servidor:", error);
      }
    }, 500);

    return () => clearTimeout(timerBuscaMid);
  }, [formData.mid]);

  // FUNÇÃO AUXILIAR: Modifica o estado do formulário vindo dos dropdowns customizados
  const handleDropdownChange = (name: string, value: string) => {
    if (name === "isParceiro") {
      const sim = value === "sim";
      setIsParceiro(sim);
      if (!sim) setFormData(prev => ({ ...prev, adquirente_nome: "" }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const recarregarLista = () => {
    setTermoBuscaReal(termoBuscaReal + " ");
    setTimeout(() => setTermoBuscaReal(termoBuscaReal.trim()), 1000);
  };

  const persistirFicha = async (estado: string) => {
    const temMid = formData.mid && formData.mid.trim() !== "";
    const temFornecedor = formData.fornecedor_nome && formData.fornecedor_nome.trim() !== "";

    if (temMid && temFornecedor && estado === "ESTOQUE") {
      setMensagemModal({
        tipo: "erro",
        texto: "Máquina vinculada a um MID e com Fornecedor não pode permanecer no status 'ESTOQUE'."
      });
      return false;
    }

    if (isParceiro && !formData.adquirente_nome) {
      setMensagemModal({
        tipo: "erro",
        texto: "Selecione o parceiro ou desmarque a opção."
      });
      return false;
    }

    const payload = {
      modelo: modeloDaFicha || null,
      numero_serial: (formData.numero_serial || "").trim().toUpperCase() || null,
      estado: estado || null,
      aquisicao: formData.aquisicao || null,
      mid: formData.mid || null,
      fornecedor_nome: formData.fornecedor_nome || null,
      adquirente_nome: isParceiro ? (formData.adquirente_nome || null) : null,
    };

    try {
      const response = await apiFetch(`/dispositivos/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) return true;
      const erro = await response.json();
      setMensagemModal({ tipo: "erro", texto: erro.detail || "Erro ao salvar alterações." });
      return false;
    } catch {
      setMensagemModal({ tipo: "erro", texto: "Erro de conexão com o servidor." });
      return false;
    }
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSalvar(true);
    setMensagemModal({ tipo: "", texto: "" });
    const ok = await persistirFicha(formData.estado);
    if (ok) {
      setMensagemModal({ tipo: "sucesso", texto: "Dispositivo atualizado com sucesso!" });
      setPaginaAtual(prev => prev);
      recarregarLista();
      setTimeout(() => setModalAberto(false), 1000);
    }
    setLoadingSalvar(false);
  };

  const handleAlterarEstado = async (alvo: "REPARO" | "MAQUINA PERDIDA") => {
    const proximo = formData.estado === alvo
      ? (formData.mid.trim() ? "NO CLIENTE" : "ESTOQUE")
      : alvo;
    setLoadingEstado(alvo);
    setMensagemModal({ tipo: "", texto: "" });
    const ok = await persistirFicha(proximo);
    if (ok) {
      setFormData(prev => ({ ...prev, estado: proximo }));
      setMensagemModal({ tipo: "sucesso", texto: `Estado alterado para ${rotuloEstado(proximo)}.` });
      recarregarLista();
    }
    setLoadingEstado(null);
  };

  // 6. EXCLUI O DISPOSITIVO (DELETE)
  const handleExcluirDispositivo = async () => {
    const confirmar = window.confirm(`Tem certeza absoluta que deseja remover a máquina com serial ${formData.numero_serial} do estoque?`);
    if (!confirmar) return;

    setLoadingExcluir(true);
    setMensagemModal({ tipo: "", texto: "" });

    try {
      const response = await apiFetch(`/dispositivos/${formData.id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setMensagemModal({ tipo: "sucesso", texto: "Máquina removida com sucesso!" });
        setTermoBuscaReal(termoBuscaReal + " ");
        setTimeout(() => {
          setTermoBuscaReal(termoBuscaReal.trim());
          setModalAberto(false);
        }, 1000);
      } else {
        setMensagemModal({ tipo: "erro", texto: "Erro ao tentar excluir o dispositivo do banco." });
      }
    } catch (error) {
      setMensagemModal({ tipo: "erro", texto: "Erro de rede ao processar exclusão." });
    } finally {
      setLoadingExcluir(false);
    }
  };

  if (carregandoInicial) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-gray-950 transition-colors">
        <p className="text-orange-600 font-medium text-lg animate-pulse">
          Carregando painel de gerenciamento...
        </p>
      </main>
    );
  }

  return (
    <main className="p-10 max-w-7xl mx-auto relative min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">

      {/* TOPO: TÍTULO E BOTÃO DE CRIAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-orange-600">Gerenciamento de Máquinas</h1>
          <p className="text-sm text-gray-900 mt-1 font-medium dark:text-white transition-colors">Clique sobre qualquer card de máquina para visualizar a ficha completa ou realizar alterações.</p>
        </div>

        <Link
          href="/novo-dispositivo"
          className="w-full md:w-auto text-center bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm shadow-sm transition-colors"
        >
          + Cadastrar Máquina
        </Link>
      </div>

      {/* BARRA DE PESQUISA */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-8 relative dark:bg-gray-900 dark:border-gray-800 transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <input
              type="text"
              value={buscaSerial}
              onChange={(e) => setBuscaSerial(e.target.value)}
              placeholder="  Digite parte do Número Serial ou o MID para filtrar os cards instantaneamente..."
              className="w-full bg-gray-50 border border-gray-300 rounded-lg py-3 px-4 pl-24 text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder-gray-400 dark:bg-gray-950 dark:border-gray-700 dark:text-white dark:focus:bg-gray-950"
            />
            <span className="absolute left-2 top-3.5 text-gray-500 font-bold text-sm font-mono pointer-events-none">SERIAL/MID:</span>

            {atualizandoLista && (
              <div className="absolute right-4 top-3.5 flex space-x-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-150"></div>
              </div>
            )}
          </div>
          <MenuFiltroDispositivos
            filtros={filtrosLista}
            onAplicar={(proximo) => {
              const qs = queryFiltros(proximo).toString();
              router.replace(qs ? `${pathname}?${qs}` : pathname);
              setPaginaAtual(1);
            }}
          />
        </div>
      </div>

      {/* GRID DE CARDS DAS MÁQUINAS */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 transition-opacity duration-200 ${atualizandoLista ? 'opacity-50' : 'opacity-100'}`}>
        {dispositivos.length === 0 && !atualizandoLista ? (
          <div className="col-span-full py-16 text-center text-gray-400 font-medium bg-white rounded-xl border border-dashed border-gray-300 dark:bg-gray-900 dark:border-gray-700 transition-colors">
            Nenhum dispositivo localizado para esses filtros.
          </div>
        ) : (
          dispositivos.map((disp: any) => (
            <div
              key={disp.id}
              onClick={() => handleCardClick(disp)}
              className="bg-white border border-gray-200 hover:border-orange-500 rounded-xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group dark:bg-gray-900 dark:border-gray-800"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-xs font-bold py-1 px-2.5 rounded-md border ${classeCorModelo(disp.modelo)}`}>
                      {disp.modelo || "Sem Modelo"}
                    </span>
                    <span className={`text-xs font-bold py-1 px-2.5 rounded-md border ${classeCorAquisicao(disp.aquisicao)}`}>
                      {rotuloAquisicao(disp.aquisicao)}
                    </span>
                  </div>

                  <span className={`w-2.5 h-2.5 rounded-full ${disp.estado === 'NO CLIENTE' ? 'bg-green-500' :
                    disp.estado === 'ESTOQUE' ? 'bg-blue-500' :
                      (disp.estado === 'REPARO' || disp.estado === 'MAQUINA PERDIDA') ? 'bg-red-500' :
                        'bg-gray-400'
                    }`} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 font-mono tracking-wider dark:text-white transition-colors">NÚMERO SERIAL</h3>
                <p className="text-base font-extrabold text-gray-900 font-mono mt-0.5 break-all dark:text-white transition-colors">
                  {disp.numero_serial || "-"}
                </p>
              </div>

              <div className="mt-4 border-t pt-3 flex justify-between items-center text-xs text-gray-600 font-medium">
                <span>MID: {disp.cliente_rel?.mid || "Nenhum"}</span>
                <span className="text-orange-600 font-bold group-hover:translate-x-1 transition-transform">Ficha →</span>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Parceiro: {disp.adquirente_rel?.nome || "Não"} · Evento: {disp.em_evento ? "Sim" : "Não"}
              </p>
            </div>
          ))
        )}
      </div>

      {/* CONTROLES DE PAGINAÇÃO */}
      {dispositivos.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-10">
          <button
            onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
            disabled={paginaAtual === 1 || atualizandoLista}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-900"
          >
            &larr; Anterior
          </button>

          <span className="text-sm font-bold text-gray-500">
            Página {paginaAtual}
          </span>

          <button
            onClick={() => setPaginaAtual(prev => prev + 1)}
            disabled={!temMaisPaginas || atualizandoLista}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-900"
          >
            Próxima &rarr;
          </button>
        </div>
      )}

      {/* =======================================================
          POP-UP INTEGRADO: FICHA COMPLETA + EDIÇÃO + EXCLUSÃO
          ======================================================= */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 dark:bg-gray-900 dark:border-gray-800 transition-colors">

            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 transition-colors">Ficha Detalhada do Dispositivo</h2>
                <p className="text-xs text-gray-400 mt-1 font-medium">Registro do Sistema ID #{formData.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="text-red-400 hover:text-red-600 text-xl font-bold bg-red-100 h-8 w-8 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {mensagemModal.texto && (
              <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${mensagemModal.tipo === "sucesso" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {mensagemModal.texto}
              </div>
            )}

            <form onSubmit={handleSalvarEdicao} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Número Serial</label>
                  <p className="w-full border border-gray-200 rounded-lg p-2.5 text-gray-900 font-semibold bg-gray-50 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                    {formData.numero_serial || "—"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Modelo</label>
                  <p className={classeMostradorModelo(modeloDaFicha, false)}>
                    {modeloDaFicha || "—"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Definido pelo número serial. Não é possível alterar.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Estado atual</label>
                <p className={classeMostradorEstado(formData.estado)}>
                  {rotuloEstado(formData.estado)}
                </p>
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => handleAlterarEstado("REPARO")}
                    disabled={loadingEstado !== null || loadingSalvar || loadingExcluir}
                    className={`flex-1 font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 ${formData.estado === "REPARO" ? "bg-amber-500 text-white hover:bg-amber-600" : "border border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950"}`}
                  >
                    {loadingEstado === "REPARO" ? "Alterando..." : formData.estado === "REPARO" ? "Sair do reparo" : "Enviar para reparo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAlterarEstado("MAQUINA PERDIDA")}
                    disabled={loadingEstado !== null || loadingSalvar || loadingExcluir}
                    className={`flex-1 font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 ${formData.estado === "MAQUINA PERDIDA" ? "bg-red-600 text-white hover:bg-red-700" : "border border-red-500 text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"}`}
                  >
                    {loadingEstado === "MAQUINA PERDIDA" ? "Alterando..." : formData.estado === "MAQUINA PERDIDA" ? "Desmarcar máquina perdida" : "Marcar máquina perdida"}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Sem MID o estado volta para estoque. Com MID, volta para no cliente.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Aquisição</label>
                  <DropdownCustomizado
                    name="aquisicao"
                    value={formData.aquisicao}
                    onChange={handleDropdownChange}
                    placeholder="Selecione..."
                    options={OPCOES_AQUISICAO}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Nome do Fornecedor</label>
                  <input type="text" list="modal-fornecedores" value={formData.fornecedor_nome} onChange={e => setFormData({ ...formData, fornecedor_nome: e.target.value })} className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-orange-500 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white transition-colors" />
                  <datalist id="modal-fornecedores">
                    {fornecedores.map((f: any) => <option key={f.id} value={f.nome} />)}
                  </datalist>
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">MID do Cliente Vinculado</label>
                <input type="text" value={formData.mid} onChange={e => setFormData({ ...formData, mid: e.target.value })} placeholder="Digite o MID para vincular o cliente..." className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-gray-900 font-bold outline-none focus:ring-2 focus:ring-orange-500 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white transition-colors" />
                {nomeClienteVisual && (
                  <p className={`mt-2 text-xs font-bold ${nomeClienteVisual.includes('⚠️') ? 'text-amber-600' : 'text-orange-600 bg-orange-50 py-1 px-2.5 rounded-md inline-block'}`}>
                    {nomeClienteVisual}
                  </p>
                )}
              </div>

              <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Máquina de parceiro</label>
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
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Em evento</label>
                  <p className="w-full border border-gray-200 rounded-lg p-2.5 text-gray-900 font-medium bg-gray-50 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                    {isEvento ? "Sim" : "Não"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Alterar pela aba Eventos.</p>
                </div>
                {isParceiro && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Parceiro</label>
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

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t mt-4">

                <button
                  type="button"
                  onClick={handleExcluirDispositivo}
                  disabled={loadingExcluir}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  🗑️ {loadingExcluir ? "Excluindo..." : "Excluir Máquina"}
                </button>

                <button
                  type="submit"
                  disabled={loadingSalvar || loadingExcluir}
                  className="w-full sm:w-44 bg-amber-500 hover:bg-amber-600 text-white font-semibold p-2.5 rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                  {loadingSalvar ? "Salvando..." : "Salvar Alterações"}
                </button>

              </div>
            </form>

          </div>
        </div>
      )}
    </main>
  );
}

export default function DispositivosPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-gray-950 transition-colors">
          <p className="text-orange-600 font-medium text-lg animate-pulse">
            Carregando painel de gerenciamento...
          </p>
        </main>
      }
    >
      <GerenciamentoDispositivos />
    </Suspense>
  );
}