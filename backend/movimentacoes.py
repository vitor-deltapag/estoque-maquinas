from datetime import date, datetime, time, timedelta

from sqlalchemy import func
from sqlalchemy.orm import selectinload

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
    totais = {"vinculos_novos": 0, "desvinculos": 0, "trocas": 0}
    for (cliente_id, bloco), itens in grupos.items():
        cliente = db.get(models.Cliente, cliente_id)
        alvo = clientes.setdefault(cliente_id, {
            "cliente_id": cliente_id,
            "cliente_nome": cliente.nome if cliente else None,
            "blocos": [],
        })
        classificado = _classificar(itens)
        if bloco == "cliente":
            totais["vinculos_novos"] += classificado["vinculos_novos"]
            totais["desvinculos"] += classificado["desvinculos"]
            totais["trocas"] += classificado["trocas"]
        alvo["blocos"].append({"bloco": bloco, **classificado})

    return {
        "inicio": inicio.date().isoformat(),
        "fim": (fim - timedelta(days=1)).date().isoformat(),
        "totais": totais,
        "clientes": list(clientes.values()),
    }


def consulta_maquina(db, serial: str):
    dispositivo = (
        db.query(models.Dispositivo)
        .options(
            selectinload(models.Dispositivo.cliente_rel),
            selectinload(models.Dispositivo.fornecedor_rel),
            selectinload(models.Dispositivo.adquirente_rel),
        )
        .filter(func.upper(models.Dispositivo.numero_serial) == serial)
        .first()
    )
    if not dispositivo:
        return None

    linhas = (
        db.query(models.MovimentacaoMaquina)
        .filter(func.upper(models.MovimentacaoMaquina.numero_serial) == serial)
        .filter(models.MovimentacaoMaquina.tipo == "VINCULO_CLIENTE")
        .order_by(models.MovimentacaoMaquina.created_at.desc(), models.MovimentacaoMaquina.id.desc())
        .limit(3)
        .all()
    )
    ultimos = []
    for linha in linhas:
        cliente = db.get(models.Cliente, linha.cliente_id) if linha.cliente_id else None
        quando = linha.created_at.isoformat() if isinstance(linha.created_at, datetime) else linha.created_at
        ultimos.append({
            "quando": quando,
            "cliente_nome": cliente.nome if cliente else None,
            "mid": cliente.mid if cliente else None,
        })

    atual = dispositivo.cliente_rel
    return {
        "numero_serial": dispositivo.numero_serial,
        "modelo": dispositivo.modelo,
        "estado": dispositivo.estado,
        "aquisicao": dispositivo.aquisicao,
        "em_evento": dispositivo.em_evento,
        "cliente_atual": {"nome": atual.nome, "mid": atual.mid} if atual else None,
        "fornecedor_nome": dispositivo.fornecedor_rel.nome if dispositivo.fornecedor_rel else None,
        "adquirente_nome": dispositivo.adquirente_rel.nome if dispositivo.adquirente_rel else None,
        "ultimos_vinculos": ultimos,
    }