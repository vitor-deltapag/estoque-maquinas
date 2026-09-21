export type FiltroMaquinas = {
  modelo: string;
  estado: string;
  aquisicao: string;
  evento: string;
  parceiro: string;
};

export const FILTRO_VAZIO: FiltroMaquinas = {
  modelo: "",
  estado: "",
  aquisicao: "",
  evento: "",
  parceiro: "",
};

export const OPCOES_FILTRO_MODELO = [
  { value: "", label: "Todos" },
  { value: "P2 BIN", label: "P2 BIN" },
  { value: "X990", label: "X990" },
  { value: "S920", label: "S920" },
  { value: "A910", label: "A910" },
  { value: "L300", label: "L300" },
];

export const OPCOES_FILTRO_ESTADO = [
  { value: "", label: "Todos" },
  { value: "NO CLIENTE", label: "No cliente" },
  { value: "ESTOQUE", label: "Estoque" },
  { value: "REPARO", label: "Reparo" },
  { value: "MAQUINA PERDIDA", label: "Perdida" },
];

export const OPCOES_FILTRO_AQUISICAO = [
  { value: "", label: "Todas" },
  { value: "ALUGADA", label: "Alugada" },
  { value: "COMPRADA", label: "Comprada" },
];

export const OPCOES_FILTRO_EVENTO = [
  { value: "", label: "Todos" },
  { value: "true", label: "Em evento" },
  { value: "false", label: "Fora de evento" },
];

export const OPCOES_FILTRO_PARCEIRO = [
  { value: "", label: "Todos" },
  { value: "true", label: "De parceiro" },
  { value: "false", label: "Sem parceiro" },
];

function soTrueFalse(valor: string | null) {
  if (valor === "true" || valor === "false") return valor;
  return "";
}

export function filtrosDaUrl(searchParams: { get: (key: string) => string | null }): FiltroMaquinas {
  return {
    modelo: searchParams.get("modelo")?.trim() || "",
    estado: searchParams.get("estado")?.trim() || "",
    aquisicao: searchParams.get("aquisicao")?.trim().toUpperCase() || "",
    evento: soTrueFalse(searchParams.get("evento")),
    parceiro: soTrueFalse(searchParams.get("parceiro")),
  };
}

export function queryFiltros(filtros: FiltroMaquinas) {
  const params = new URLSearchParams();
  if (filtros.modelo) params.set("modelo", filtros.modelo);
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.aquisicao) params.set("aquisicao", filtros.aquisicao);
  if (filtros.evento) params.set("evento", filtros.evento);
  if (filtros.parceiro) params.set("parceiro", filtros.parceiro);
  return params;
}

export function contarFiltros(filtros: FiltroMaquinas) {
  return Object.values(filtros).filter(Boolean).length;
}
