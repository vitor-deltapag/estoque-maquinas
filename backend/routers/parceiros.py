from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, func

from database import get_db
from deps import get_current_user
from helpers import empty_to_none
from log import logger
import models
import schemas

router = APIRouter(tags=["parceiros"])

_RELS = (
    selectinload(models.Cliente.dispositivos_parceiro).selectinload(models.Dispositivo.cliente_rel),
    selectinload(models.Cliente.dispositivos_parceiro).selectinload(models.Dispositivo.fornecedor_rel),
    selectinload(models.Cliente.dispositivos_parceiro).selectinload(models.Dispositivo.adquirente_rel),
)


def _resposta(
    item: models.Cliente,
    *,
    dispositivos: list | None = None,
    qtd_maquinas: int | None = None,
) -> schemas.ParceiroResponse:
    maquinas = list(item.dispositivos_parceiro or []) if dispositivos is None else dispositivos
    return schemas.ParceiroResponse(
        id=item.id,
        nome=item.nome,
        nome_fantasia=item.nome_fantasia,
        mid=item.mid,
        parceiro=True,
        created_at=item.created_at,
        qtd_maquinas=len(maquinas) if qtd_maquinas is None else qtd_maquinas,
        dispositivos=maquinas,
    )


def _parceiro_por_id(db: Session, item_id: int) -> models.Cliente | None:
    return (
        db.query(models.Cliente)
        .options(*_RELS)
        .filter(models.Cliente.id == item_id, models.Cliente.parceiro.is_(True))
        .first()
    )


@router.get("/parceiros", response_model=List[schemas.ParceiroResponse])
def listar_parceiros(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    query = db.query(models.Cliente).filter(models.Cliente.parceiro.is_(True))
    if search:
        query = query.filter(
            or_(
                models.Cliente.nome.ilike(f"%{search}%"),
                models.Cliente.nome_fantasia.ilike(f"%{search}%"),
                models.Cliente.mid.ilike(f"%{search}%"),
            )
        )
    itens = query.order_by(models.Cliente.id.desc()).all()
    ids = [item.id for item in itens]
    contagens = {}
    if ids:
        contagens = dict(
            db.query(models.Dispositivo.adquirente, func.count(models.Dispositivo.id))
            .filter(models.Dispositivo.adquirente.in_(ids))
            .group_by(models.Dispositivo.adquirente)
            .all()
        )
    return [
        schemas.ParceiroResponse(
            id=item.id,
            nome=item.nome,
            nome_fantasia=item.nome_fantasia,
            mid=item.mid,
            parceiro=True,
            created_at=item.created_at,
            qtd_maquinas=int(contagens.get(item.id, 0)),
            dispositivos=[],
        )
        for item in itens
    ]


@router.post("/parceiros", response_model=schemas.ParceiroResponse, status_code=status.HTTP_201_CREATED)
def criar_parceiro(
    payload: schemas.ParceiroCreate,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    novo = models.Cliente(
        nome=payload.nome,
        nome_fantasia=empty_to_none(payload.nome_fantasia),
        mid=empty_to_none(payload.mid),
        parceiro=True,
    )
    try:
        db.add(novo)
        db.commit()
        db.refresh(novo)
    except IntegrityError:
        db.rollback()
        logger.warning("IntegrityError ao criar parceiro")
        raise HTTPException(status_code=400, detail="MID já cadastrado.")
    item = _parceiro_por_id(db, novo.id)
    return _resposta(item)


@router.get("/parceiros/{item_id}", response_model=schemas.ParceiroResponse)
def obter_parceiro(
    item_id: int,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    item = _parceiro_por_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    return _resposta(item)


@router.put("/parceiros/{item_id}", response_model=schemas.ParceiroResponse)
def atualizar_parceiro(
    item_id: int,
    payload: schemas.ParceiroCreate,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    item = db.query(models.Cliente).filter(
        models.Cliente.id == item_id, models.Cliente.parceiro.is_(True)
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")

    item.nome = payload.nome
    item.nome_fantasia = empty_to_none(payload.nome_fantasia)
    item.mid = empty_to_none(payload.mid)
    item.parceiro = True  # esta aba não desmarca a tag
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.warning("IntegrityError ao atualizar parceiro")
        raise HTTPException(status_code=400, detail="MID já cadastrado.")
    return _resposta(_parceiro_por_id(db, item_id))


@router.delete("/parceiros/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_parceiro(
    item_id: int,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    item = db.query(models.Cliente).filter(
        models.Cliente.id == item_id, models.Cliente.parceiro.is_(True)
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")

    como_cliente = db.query(models.Dispositivo).filter(models.Dispositivo.cliente == item.id).first()
    como_parceiro = db.query(models.Dispositivo).filter(models.Dispositivo.adquirente == item.id).first()
    if como_cliente or como_parceiro:
        raise HTTPException(
            status_code=400,
            detail="Não é possível excluir um parceiro que possui máquinas vinculadas.",
        )
    db.delete(item)
    db.commit()