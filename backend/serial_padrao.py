"""Padrão de serial por modelo. Prefixo mais longo primeiro."""

PADROES = (
    ("VF8", "X990", 10),
    ("PB", "P2 BIN", 13),
    ("4A", "L300", 9),
    ("14", "A910", 10),
    ("6", "S920", 8),
)


def classificar_serial(valor: str) -> tuple[str | None, str | None]:
    serial = (valor or "").strip().upper()
    if not serial:
        return None, "Serial vazio."
    for prefixo, modelo, tamanho in PADROES:
        if serial.startswith(prefixo):
            if len(serial) != tamanho:
                return None, f"{serial}: {modelo} precisa ter {tamanho} caracteres."
            return modelo, None
    return None, (
        f"{serial}: fora do padrão. X990 começa com VF8, P2 com PB, L300 com 4A, A910 com 14 e S920 com 6."
    )
