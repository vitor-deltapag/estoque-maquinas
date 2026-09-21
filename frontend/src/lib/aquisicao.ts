const CORES_AQUISICAO: Record<string, string> = {
  COMPRADA:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  ALUGADA:
    "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300",
};

const COR_VAZIA =
  "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400";

export const OPCOES_AQUISICAO = [
  { value: "ALUGADA", label: "Alugada" },
  { value: "COMPRADA", label: "Comprada" },
];

export function rotuloAquisicao(aquisicao?: string | null): string {
  if (aquisicao === "COMPRADA") return "Comprada";
  if (aquisicao === "ALUGADA") return "Alugada";
  return "Sem aquisição";
}

export function classeCorAquisicao(aquisicao?: string | null): string {
  if (aquisicao && CORES_AQUISICAO[aquisicao]) return CORES_AQUISICAO[aquisicao];
  return COR_VAZIA;
}
