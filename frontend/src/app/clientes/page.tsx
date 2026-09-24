"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { useMensagem, useToastErro } from "../../components/ToastErro";
import DropdownCustomizado from "../../components/DropdownCustomizado";

export default function ListaClientes() {
  // Estados do sistema
  const [clientes, setClientes] = useState<any[]>([]);

  // Estados de Busca e Paginação (Alta Performance)
  const [buscaTexto, setBuscaTexto] = useState("");
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
  const [mensagemModal, setMensagemModal] = useMensagem();

  const mostrarErro = useToastErro();
  const [sincronizando, setSincronizando] = useState(false);
  const [resumoSync, setResumoSync] = useState("");
  const [recarga, setRecarga] = useState(0);

  // Dados do formulário interno do Pop-up
  const [formData, setFormData] = useState({
    id: "", nome: "", nome_fantasia: "", mid: "", status: "", distribuidor_nome: "", parceiro: false
  });

  // 1. DEBOUNCE (Espera você parar de digitar para pesquisar)
  useEffect(() => {
    const timer = setTimeout(() => {
      setTermoBuscaReal(buscaTexto);
      setPaginaAtual(1); // Volta para a página 1 ao fazer uma nova busca
    }, 500);
    return () => clearTimeout(timer);
  }, [buscaTexto]);

  // 2. BUSCA CLIENTES NO SERVIDOR (Sempre que a página ou termo mudar)
  useEffect(() => {
    async function buscarClientes() {
      setAtualizandoLista(true);
      try {
        const params = new URLSearchParams({
          page: paginaAtual.toString(),
          limit: LIMITE_POR_PAGINA.toString(),
        });
        if (termoBuscaReal) params.append("search", termoBuscaReal);
        const response = await apiFetch(`/clientes?${params.toString()}`, { cache: "no-store" });
        if (response.ok) {
          const dados = await response.json();
          setClientes(Array.isArray(dados) ? dados : []);
          setTemMaisPaginas(dados.length === LIMITE_POR_PAGINA);
        }
      } catch (error) {
        console.error("Erro ao conectar com a API:", error);
      } finally {
        setCarregandoInicial(false);
        setAtualizandoLista(false);
      }
    }
    buscarClientes();
  }, [termoBuscaReal, paginaAtual, recarga]);

  useEffect(() => {
    apiFetch("/clientes/sincronizar", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((corpo) => {
        if (corpo?.criados || corpo?.atualizados) setRecarga((n) => n + 1);
      })
      .catch(() => {});
  }, []);

  const handleSincronizar = async () => {
    setSincronizando(true);
    setResumoSync("");
    try {
      const res = await apiFetch("/clientes/sincronizar?forcar=true", { method: "POST" });
      const corpo = await res.json();
      if (!res.ok) {
        mostrarErro(corpo.detail || "Erro ao sincronizar com a Movingpay.");
        return;
      }
      if (corpo.ignorado === "em andamento") {
        setResumoSync("Já existe uma sincronização em andamento. Tente de novo em instantes.");
        return;
      }
      const partes = [`${corpo.criados} novos`, `${corpo.atualizados} atualizados`];
      if (corpo.ignorados) partes.push(`${corpo.ignorados} sem MID`);
      if (corpo.falhas?.length) partes.push(`${corpo.falhas.length} com falha`);
      setResumoSync(`Movingpay: ${partes.join(", ")}.`);
      setRecarga((n) => n + 1);
    } catch {
      mostrarErro("Erro de conexão com o servidor.");
    } finally {
      setSincronizando(false);
    }
  };

  // 3. ABRE O POP-UP AO CLICAR NO CARD
  const handleCardClick = (cliente: any) => {
    setFormData({
      id: cliente.id,
      nome: cliente.nome || "",
      nome_fantasia: cliente.nome_fantasia || "",
      mid: cliente.mid || "",
      status: cliente.status || "",
      distribuidor_nome: cliente.distribuidor_nome || "",
      parceiro: Boolean(cliente.parceiro)
    });
    setMensagemModal({ tipo: "", texto: "" });
    setModalAberto(true);
  };

  // 4. SALVA AS ALTERAÇÕES (PUT)
  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSalvar(true);
    setMensagemModal({ tipo: "", texto: "" });

    try {
      const response = await apiFetch(`/clientes/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.nome,
          nome_fantasia: formData.nome_fantasia || null,
          mid: formData.mid || null,
          parceiro: formData.parceiro
        }),
      });

      if (response.ok) {
        setMensagemModal({ tipo: "sucesso", texto: "Cliente atualizado com sucesso!" });
        setPaginaAtual(prev => prev);
        setTermoBuscaReal(termoBuscaReal + " "); // Hack para recarregar a lista atual
        setTimeout(() => {
          setTermoBuscaReal(termoBuscaReal.trim());
          setModalAberto(false);
        }, 1000);
      } else {
        const erro = await response.json();
        setMensagemModal({ tipo: "erro", texto: erro.detail || "Erro ao salvar alterações." });
      }
    } catch (error) {
      setMensagemModal({ tipo: "erro", texto: "Erro de conexão com o servidor." });
    } finally {
      setLoadingSalvar(false);
    }
  };

  // 5. EXCLUI O CLIENTE (DELETE)
  const handleExcluirCliente = async () => {
    const confirmar = window.confirm(`Tem certeza absoluta que deseja remover o cliente "${formData.nome}"?`);
    if (!confirmar) return;

    setLoadingExcluir(true);
    setMensagemModal({ tipo: "", texto: "" });

    try {
      const response = await apiFetch(`/clientes/${formData.id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setMensagemModal({ tipo: "sucesso", texto: "Cliente removido com sucesso!" });
        setTermoBuscaReal(termoBuscaReal + " ");
        setTimeout(() => {
          setTermoBuscaReal(termoBuscaReal.trim());
          setModalAberto(false);
        }, 1000);
      } else {
        // Se houver máquinas vinculadas, o backend envia um erro 400
        const erro = await response.json();
        setMensagemModal({ tipo: "erro", texto: erro.detail || "Erro ao tentar excluir o cliente." });
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
          Carregando clientes...
        </p>
      </main>
    );
  }

  return (
    <main className="p-10 max-w-7xl mx-auto relative min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">

      {/* TOPO: TÍTULO E BOTÃO DE ATUALIZAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-orange-600">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Clientes vêm da Movingpay pelo MID. A lista se atualiza ao abrir esta tela.</p>
          {resumoSync && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 font-medium">{resumoSync}</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSincronizar}
          disabled={sincronizando}
          className="w-full md:w-auto text-center bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50"
        >
          {sincronizando ? "Atualizando..." : "Atualizar da Movingpay"}
        </button>
      </div>

      {/* BARRA DE PESQUISA OTIMIZADA */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-8 relative dark:bg-gray-900 dark:border-gray-800 transition-colors">
        <div className="relative">
          <input
            type="text"
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
            placeholder="Digite a Razão Social, Nome Fantasia ou MID para filtrar..."
            className="w-full bg-gray-50 border border-gray-300 rounded-lg py-3 px-4 pl-24 text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder-gray-400 dark:bg-gray-950 dark:border-gray-700 dark:text-white dark:focus:bg-gray-950"
          />
          <span className="absolute left-4 top-3.5 text-gray-500 font-bold text-sm font-mono pointer-events-none">BUSCA:</span>

          {/* Indicador de carregamento */}
          {atualizandoLista && (
            <div className="absolute right-4 top-3.5 flex space-x-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-150"></div>
            </div>
          )}
        </div>
      </div>

      {/* GRID DE CARDS DOS CLIENTES */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 transition-opacity duration-200 ${atualizandoLista ? 'opacity-50' : 'opacity-100'}`}>
        {clientes.length === 0 && !atualizandoLista ? (
          <div className="col-span-full py-16 text-center text-gray-400 font-medium bg-white rounded-xl border border-dashed border-gray-300 dark:bg-gray-900 dark:border-gray-700 transition-colors">
            Nenhum cliente localizado para a busca "{buscaTexto}".
          </div>
        ) : (
          clientes.map((c: any) => (
            <div
              key={c.id}
              onClick={() => handleCardClick(c)}
              className="bg-white border border-gray-200 hover:border-orange-500 rounded-xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group dark:bg-gray-900 dark:border-gray-800"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 py-1 px-2.5 rounded-md transition-colors">
                    MID: {c.mid || "S/N"}
                  </span>
                  <span className="flex gap-1">
                    {c.status && (
                      <span className={`text-xs font-bold py-1 px-2.5 rounded-md ${c.status.toUpperCase() === "ATIVO" ? "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40" : "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40"}`}>
                        {c.status.toUpperCase() === "ATIVO" ? "Ativo" : "Inativo"}
                      </span>
                    )}
                    {c.parceiro && (
                      <span className="text-xs font-bold text-teal-700 bg-teal-100 dark:text-teal-300 dark:bg-teal-900/40 py-1 px-2.5 rounded-md">
                        Parceiro
                      </span>
                    )}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 mt-2 truncate dark:text-white transition-colors">
                  {c.nome}
                </h3>
                <p className="text-sm font-bold text-gray-400 mt-1 truncate">
                  {c.nome_fantasia || "Sem Nome Fantasia"}
                </p>
              </div>

              <div className="mt-5 border-t pt-3 flex justify-end items-center text-xs text-gray-400 font-medium">
                <span className="text-orange-600 font-bold group-hover:translate-x-1 transition-transform">Editar Cadastro →</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CONTROLES DE PAGINAÇÃO */}
      {clientes.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-10">
          <button
            onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
            disabled={paginaAtual === 1 || atualizandoLista}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-900"
          >
            ← Anterior
          </button>

          <span className="text-sm font-bold text-gray-500">
            Página {paginaAtual}
          </span>

          <button
            onClick={() => setPaginaAtual(prev => prev + 1)}
            disabled={!temMaisPaginas || atualizandoLista}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-900"
          >
            Próxima →
          </button>
        </div>
      )}

      {/* =======================================================
          POP-UP INTEGRADO: EDIÇÃO + EXCLUSÃO
         ======================================================= */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
          <div className="flex min-h-full items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg p-8 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 dark:bg-gray-900 dark:border-gray-800 transition-colors">

            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 transition-colors">Ficha do Cliente</h2>
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

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Razão Social (Nome)</label>
                <p className="w-full border border-gray-200 rounded-lg p-2.5 text-gray-900 font-bold bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                  {formData.nome || "—"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Nome Fantasia</label>
                <p className="w-full border border-gray-200 rounded-lg p-2.5 text-gray-900 font-semibold bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                  {formData.nome_fantasia || "—"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Número MID</label>
                <p className="w-full border border-gray-200 rounded-lg p-2.5 text-gray-900 font-semibold bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                  {formData.mid || "—"}
                </p>
                <p className="mt-1 text-xs text-gray-500">Razão social, fantasia e MID vêm da Movingpay. Não é possível alterar aqui.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Distribuidor</label>
                <p className="w-full border border-gray-200 rounded-lg p-2.5 text-gray-900 font-semibold bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                  {formData.distribuidor_nome || "—"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Situação na Movingpay</label>
                <p className={`w-full border rounded-lg p-2.5 font-bold ${formData.status && formData.status.toUpperCase() !== "ATIVO" ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300" : "border-gray-200 bg-gray-50 text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white"}`}>
                  {!formData.status ? "Ainda não sincronizado" : formData.status.toUpperCase() === "ATIVO" ? "Ativo" : "Inativo"}
                </p>
                <p className="mt-1 text-xs text-gray-500">Vem da Movingpay. Não é possível alterar aqui. Cliente inativo não recebe máquina.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 dark:text-gray-300 transition-colors">Parceiro</label>
                <DropdownCustomizado
                  value={formData.parceiro ? "sim" : "nao"}
                  onChange={(valor) => setFormData({ ...formData, parceiro: valor === "sim" })}
                  options={[
                    { value: "nao", label: "Não" },
                    { value: "sim", label: "Sim" },
                  ]}
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t mt-4">

                <button
                  type="button"
                  onClick={handleExcluirCliente}
                  disabled={loadingExcluir}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  🗑️ {loadingExcluir ? "Excluindo..." : "Excluir Cliente"}
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
        </div>
      )}
    </main>
  );
}