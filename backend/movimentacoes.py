from datetime import date, datetime, time, timedelta

import models

ENTRADA = {"VINCULO_CLIENTE": "cliente", "ENTRADA_EVENTO": "evento"}
SAIDA = {"DESVINCULO_CLIENTE": "cliente", "SAIDA_EVENTO": "evento"}


def registrar(db, *, tipo, dispositivo, cliente_id, evento_id=None, created_at=None):
    if not cliente_id:
        return
    db.add(models.MovimentacaoMaquina(
        tipo=tipo,
        dispositivo_id=dispositivo.id,
        cliente_id=cliente_id,
        evento_id=evento_id,
        numero_serial=dispositivo.numero_serial,
        modelo=dispositivo.modelo or "",
        created_at=created_at or datetime.now(),
    ))


def _inicio_semana(dia: date) -> datetime:
    segunda = dia - timedelta(days=dia.weekday())
    return datetime.combine(segunda, time.min)


def _classificar(linhas):
    por_serial = {}
    for linha in linhas:
        item = por_serial.setdefault(linha.numero_serial, {"modelo": linha.modelo, "entradas": 0, "saidas": 0})
        if linha.tipo in ENTRADA:
            item["entradas"] += 1
        else:
            item["saidas"] += 1

    detalhe = []
    saidas_liquidas = []
    entradas_liquidas = []
    for serial in sorted(por_serial):
        item = por_serial[serial]
        anuladas = min(item["entradas"], item["saidas"])
        if anuladas:
            detalhe.append({"numero_serial": serial, "modelo": item["modelo"], "situacao": "nao_alterou"})
        for _ in range(item["saidas"] - anuladas):
            saidas_liquidas.append((serial, item["modelo"]))
        for _ in range(item["entradas"] - anuladas):
            entradas_liquidas.append((serial, item["modelo"]))

    trocas = min(len(saidas_liquidas), len(entradas_liquidas))
    for serial, modelo in saidas_liquidas[:trocas]:
        detalhe.append({"numero_serial": serial, "modelo": modelo, "situacao": "troca_saida"})
    for serial, modelo in entradas_liquidas[:trocas]:
        detalhe.append({"numero_serial": serial, "modelo": modelo, "situacao": "troca_entrada"})
    for serial, modelo in saidas_liquidas[trocas:]:
        detalhe.append({"numero_serial": serial, "modelo": modelo, "situacao": "desvinculo"})
    for serial, modelo in entradas_liquidas[trocas:]:
        detalhe.append({"numero_serial": serial, "modelo": modelo, "situacao": "vinculo_novo"})

    return {
        "trocas": trocas,
        "vinculos_novos": len(entradas_liquidas) - trocas,
        "desvinculos": len(saidas_liquidas) - trocas,
        "detalhe": detalhe,
    }


def resumo_semana(db, dia: date):
    inicio = _inicio_semana(dia)
    fim = inicio + timedelta(days=7)
    linhas = (
        db.query(models.MovimentacaoMaquina)
        .filter(models.MovimentacaoMaquina.created_at >= inicio)
        .filter(models.MovimentacaoMaquina.created_at < fim)
        .all()
    )
    grupos = {}
    for linha in linhas:
        bloco = ENTRADA.get(linha.tipo) or SAIDA.get(linha.tipo)
        if not bloco or not linha.cliente_id:
            continue
        grupos.setdefault((linha.cliente_id, bloco), []).append(linha)

    clientes = {}
    for (cliente_id, bloco), itens in grupos.items():
        cliente = db.get(models.Cliente, cliente_id)
        alvo = clientes.setdefault(cliente_id, {
            "cliente_id": cliente_id,
            "cliente_nome": cliente.nome if cliente else None,
            "blocos": [],
        })
        alvo["blocos"].append({"bloco": bloco, **_classificar(itens)})

    return {
        "inicio": inicio.date().isoformat(),
        "fim": (fim - timedelta(days=1)).date().isoformat(),
        "clientes": list(clientes.values()),
    }