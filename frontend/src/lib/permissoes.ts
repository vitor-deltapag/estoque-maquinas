export type Permissoes = {
  ver_movimentacoes: boolean;
  baixar_movimentacoes: boolean;
  gerir_usuarios: boolean;
  desvincular_maquina: boolean;
  alterar_estoque: boolean;
};

export const PADRAO: Record<string, Permissoes> = {
  ADMIN: {
    ver_movimentacoes: true,
    baixar_movimentacoes: true,
    gerir_usuarios: true,
    desvincular_maquina: true,
    alterar_estoque: true,
  },
  OPERACIONAL: {
    ver_movimentacoes: true,
    baixar_movimentacoes: false,
    gerir_usuarios: false,
    desvincular_maquina: true,
    alterar_estoque: true,
  },
  COMERCIAL: {
    ver_movimentacoes: false,
    baixar_movimentacoes: false,
    gerir_usuarios: false,
    desvincular_maquina: true,
    alterar_estoque: false,
  },
};

export const OPCOES_PERFIL = [
  { value: "OPERACIONAL", label: "Operacional" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "ADMIN", label: "Admin" },
];

export const ROTULOS_PERMISSAO: { chave: keyof Permissoes; label: string }[] = [
  { chave: "ver_movimentacoes", label: "Ver movimentações" },
  { chave: "baixar_movimentacoes", label: "Baixar TXT da semana" },
  { chave: "gerir_usuarios", label: "Gerir usuários" },
  { chave: "desvincular_maquina", label: "Desvincular máquinas" },
  { chave: "alterar_estoque", label: "Cadastrar, editar e excluir" },
];

export function perfilBase(perfil?: string) {
  const valor = (perfil || "OPERACIONAL").toUpperCase();
  if (valor === "COMUM") return "OPERACIONAL";
  return valor in PADRAO ? valor : "OPERACIONAL";
}

export function rotuloPerfil(perfil?: string) {
  const base = perfilBase(perfil);
  if (base === "ADMIN") return "Admin";
  if (base === "COMERCIAL") return "Comercial";
  return "Operacional";
}

export function permissoesDoPerfil(perfil?: string): Permissoes {
  return { ...PADRAO[perfilBase(perfil)] };
}
