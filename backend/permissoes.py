"""Permissões efetivas por perfil, com override por usuário."""

CHAVES = (
    "ver_movimentacoes",
    "baixar_movimentacoes",
    "gerir_usuarios",
    "desvincular_maquina",
    "alterar_estoque",
)

_TUDO = {chave: True for chave in CHAVES}

PADRAO = {
    "ADMIN": dict(_TUDO),
    "OPERACIONAL": {
        "ver_movimentacoes": True,
        "baixar_movimentacoes": False,
        "gerir_usuarios": False,
        "desvincular_maquina": True,
        "alterar_estoque": True,
    },
    "COMERCIAL": {
        "ver_movimentacoes": False,
        "baixar_movimentacoes": False,
        "gerir_usuarios": False,
        "desvincular_maquina": True,
        "alterar_estoque": False,
    },
}


def normalizar_perfil(perfil: str | None) -> str:
    valor = (perfil or "OPERACIONAL").strip().upper()
    if valor == "COMUM":
        return "OPERACIONAL"
    if valor in PADRAO:
        return valor
    return "OPERACIONAL"


def efetivas(usuario) -> dict:
    base = dict(PADRAO[normalizar_perfil(getattr(usuario, "perfil", None))])
    salvas = getattr(usuario, "permissoes", None)
    if isinstance(salvas, dict):
        for chave in CHAVES:
            if chave in salvas:
                base[chave] = bool(salvas[chave])
    return base


def pode(usuario, chave: str) -> bool:
    return bool(efetivas(usuario).get(chave))


def gravar_permissoes(perfil: str | None, enviadas) -> dict | None:
    if not isinstance(enviadas, dict):
        return None
    padrao = PADRAO[normalizar_perfil(perfil)]
    diferencas = {}
    for chave in CHAVES:
        if chave not in enviadas:
            continue
        valor = bool(enviadas[chave])
        if valor != padrao[chave]:
            diferencas[chave] = valor
    return diferencas or None
