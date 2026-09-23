const PREFIXOS: { prefixo: string; modelo: string }[] = [
  { prefixo: "VF8", modelo: "X990" },
  { prefixo: "PB", modelo: "P2 BIN" },
  { prefixo: "4A", modelo: "L300" },
  { prefixo: "14", modelo: "A910" },
  { prefixo: "6", modelo: "S920" },
];

const BASE_MOSTRADOR = "w-full border rounded-lg p-2.5 font-semibold";

const CORES_MODELO: Record<string, string> = {
  "P2 BIN": "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  "X990": "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  "S920": "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-300",
  "A910": "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  "L300": "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
};

export function modeloPorSerial(serial: string): string {
  const texto = serial.trim().toUpperCase();
  if (!texto) return "";
  const achado = PREFIXOS.find((item) => texto.startsWith(item.prefixo));
  return achado?.modelo || "";
}

export function modeloDoLote(seriais: string[]): { modelo: string; conflito: boolean } {
  const modelos = new Set(seriais.map(modeloPorSerial).filter(Boolean));
  if (modelos.size > 1) return { modelo: "", conflito: true };
  return { modelo: [...modelos][0] || "", conflito: false };
}

const COR_MODELO_VAZIO =
  "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400";

export function classeCorModelo(modelo?: string | null): string {
  if (modelo && CORES_MODELO[modelo]) return CORES_MODELO[modelo];
  return COR_MODELO_VAZIO;
}

export function classeMostradorModelo(modelo: string, conflito: boolean): string {
  if (conflito) {
    return `${BASE_MOSTRADOR} border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300`;
  }
  return `${BASE_MOSTRADOR} ${classeCorModelo(modelo)}`;
}

export function classeMostradorEstado(estado: string): string {
  if (estado === "NO CLIENTE") {
    return `${BASE_MOSTRADOR} border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300`;
  }
  if (estado === "REPARO" || estado === "MAQUINA PERDIDA") {
    return `${BASE_MOSTRADOR} border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300`;
  }
  return `${BASE_MOSTRADOR} border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300`;
}

export function rotuloEstado(estado: string): string {
  if (estado === "MAQUINA PERDIDA") return "MÁQUINA PERDIDA";
  return estado || "—";
}
