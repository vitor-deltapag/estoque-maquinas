from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func

from database import get_db
from deps import exigir_permissao, get_current_user
from helpers import empty_to_none
from log import logger
import models
import schemas
from movimentacoes import registrar

router = APIRouter(tags=["eventos"])

_RELS_EVENTO = (
    selectinload(models.Evento.cliente_rel),
    selectinload(models.Evento.dispositivos).selectinload(models.Dispositivo.cliente_rel),
    selectinload(models.Evento.dispositivos).selectinload(models.Dispositivo.fornecedor_rel),
    selectinload(models.Evento.dispositivos).selectinload(models.Dispositivo.adquirente_rel),
)


def _situacao(evento: models.Evento) -> str:
    if evento.status == "FINALIZADO":
        return "FINALIZADO"
    if evento.data_fim < date.today():
        return "PENDENTE"
    return "ABERTO"


def _resposta(evento: models.Evento) -> schemas.EventoResponse:
    return schemas.EventoResponse(
        id=evento.id,
        nome=evento.nome,
        cliente_id=evento.cliente_id,
        data_inicio=evento.data_inicio,
        data_fim=evento.data_fim,
        status=evento.status,
        situacao=_situacao(evento),
        qtd_maquinas=len(evento.dispositivos or []),
        created_at=evento.created_at,
        data_finalizacao=evento.data_finalizacao,
        cliente_rel=evento.cliente_rel,
        dispositivos=evento.dispositivos or [],
    )


def _evento_por_id(db: Session, item_id: int) -> models.Evento | None:
    return (
        db.query(models.Evento)
        .options(*_RELS_EVENTO)
        .filter(models.Evento.id == item_id)
        .first()
    )


@router.get("/eventos", response_model=List[schemas.EventoResponse])
def listar_eventos(
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    itens = (
        db.query(models.Evento)
        .options(*_RELS_EVENTO)
        .order_by(models.Evento.id.desc())
        .all()
    )
    return [_resposta(item) for item in itens]


@router.post("/eventos", response_model=schemas.EventoResponse, status_code=status.HTTP_201_CREATED)
def criar_evento(
    payload: schemas.EventoCreate,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(exigir_permissao("alterar_estoque")),
):
    if payload.data_fim < payload.data_inicio:
        raise HTTPException(status_code=400, detail="A data de término deve ser igual ou posterior à data do evento.")

    mid = empty_to_none(payload.mid)
    if not mid:
        raise HTTPException(status_code=400, detail="Informe o MID do cliente do evento.")

    cliente = db.query(models.Cliente).filter(models.Cliente.mid == mid).first()
    if not cliente:
        raise HTTPException(status_code=400, detail=f"O MID '{mid}' não está cadastrado no sistema.")

    seriais = []
    vistos = set()
    for bruto in payload.numero_seriais:
        serial = empty_to_none(bruto)
        if serial:
            serial = serial.upper()
        if not serial or serial in vistos:
            continue
        vistos.add(serial)
        seriais.append(serial)

    if not seriais:
        raise HTTPException(status_code=400, detail="Selecione ao menos uma máquina para o evento.")

    maquinas = []
    for serial in seriais:
        item = (
            db.query(models.Dispositivo)
            .filter(func.upper(models.Dispositivo.numero_serial) == serial)
            .first()
        )
        if not item:
            raise HTTPException(status_code=400, detail=f"O serial '{serial}' não está cadastrado no sistema.")
        if item.em_evento:
            raise HTTPException(
                status_code=400,
                detail=f"A máquina '{serial}' já está vinculada a um evento em andamento.",
            )
        maquinas.append(item)

    nome = empty_to_none(payload.nome)
    novo = models.Evento(
        nome=nome,
        cliente_id=cliente.id,
        data_inicio=payload.data_inicio,
        data_fim=payload.data_fim,
        status="ABERTO",
    )
    try:
        db.add(novo)
        db.flush()
        novo.dispositivos = maquinas
        for maquina in maquinas:
            maquina.em_evento = True
            maquina.evento_id = novo.id
        for maquina in maquinas:
            registrar(
                db,
                tipo="ENTRADA_EVENTO",
                dispositivo=maquina,
                cliente_id=novo.cliente_id,
                evento_id=novo.id,
                usuario=user,
            )
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.warning("IntegrityError ao criar evento")
        raise HTTPException(status_code=400, detail="Não foi possível criar o evento.")

    criado = _evento_por_id(db, novo.id)
    if not criado:
        raise HTTPException(status_code=500, detail="Evento criado, mas não foi possível recarregá-lo.")
    return _resposta(criado)


@router.get("/eventos/{item_id}", response_model=schemas.EventoResponse)
def obter_evento(
    item_id: int,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    item = _evento_por_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return _resposta(item)


@router.post("/eventos/{item_id}/finalizar", response_model=schemas.EventoResponse)
def finalizar_evento(
    item_id: int,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(exigir_permissao("alterar_estoque")),
):
    item = _evento_por_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    if item.status == "FINALIZADO":
        raise HTTPException(status_code=400, detail="Este evento já foi finalizado.")

    item.status = "FINALIZADO"
    item.data_finalizacao = datetime.now()
    for maquina in item.dispositivos:
        registrar(
            db,
            tipo="SAIDA_EVENTO",
            dispositivo=maquina,
            cliente_id=item.cliente_id,
            evento_id=item.id,
            usuario=user,
        )
        maquina.em_evento = False
        maquina.evento_id = None
    db.commit()
    atualizado = _evento_por_id(db, item_id)
    if not atualizado:
        raise HTTPException(status_code=500, detail="Evento finalizado, mas não foi possível recarregá-lo.")
    return _resposta(atualizado)
