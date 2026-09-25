from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from typing import List, Optional

from database import get_db
from deps import exigir_permissao, get_current_user
from helpers import empty_to_none
from log import logger
from movingpay import MovingpayErro, sincronizar_clientes
import models
import schemas

router = APIRouter(tags=["clientes"])


def _anexar_distribuidor(db: Session, clientes: list) -> list:
    if not clientes:
        return clientes
    linhas = (
        db.query(models.Dispositivo.cliente, models.Fornecedor.nome)
        .join(models.Fornecedor, models.Dispositivo.fornecedor == models.Fornecedor.id)
        .filter(models.Dispositivo.cliente.in_([cliente.id for cliente in clientes]))
        .distinct()
        .all()
    )
    nomes: dict[int, list[str]] = {}
    for cliente_id, nome in linhas:
        if nome and nome not in nomes.setdefault(cliente_id, []):
            nomes[cliente_id].append(nome)
    for cliente in clientes:
        lista = sorted(nomes.get(cliente.id) or [])
        cliente.distribuidor_nome = ", ".join(lista) if lista else None
    return clientes


@router.get("/clientes", response_model=List[schemas.ClienteResponse])
def listar_clientes(
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    parceiro: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user)
):
    query = db.query(models.Cliente)

    if search:
        query = query.filter(
            or_(
                models.Cliente.nome.ilike(f"%{search}%"),
                models.Cliente.nome_fantasia.ilike(f"%{search}%"),
                models.Cliente.mid.ilike(f"%{search}%")
            )
        )

    if parceiro is True:
        query = query.filter(models.Cliente.parceiro.is_(True))
    elif parceiro is False:
        query = query.filter(models.Cliente.parceiro.is_(False))

    query = query.order_by(models.Cliente.id.desc())
    offset = (page - 1) * limit
    return _anexar_distribuidor(db, query.offset(offset).limit(limit).all())


@router.get("/clientes/{item_id}", response_model=schemas.ClienteResponse)
def obter_cliente(item_id: int, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(get_current_user)):
    item = db.query(models.Cliente).filter(models.Cliente.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return _anexar_distribuidor(db, [item])[0]


@router.post("/clientes", response_model=schemas.ClienteResponse, status_code=status.HTTP_201_CREATED)
def criar_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(exigir_permissao("alterar_estoque"))):
    dados = cliente.model_dump()
    dados.pop("status", None)
    dados["mid"] = empty_to_none(dados.get("mid"))
    novo = models.Cliente(**dados)
    try:
        db.add(novo)
        db.commit()
        db.refresh(novo)
        return novo
    except IntegrityError:
        db.rollback()
        logger.warning("IntegrityError ao criar cliente")
        raise HTTPException(status_code=400, detail="MID já cadastrado.")


@router.put("/clientes/{item_id}", response_model=schemas.ClienteResponse)
def atualizar_cliente(item_id: int, cliente: schemas.ClienteCreate, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(exigir_permissao("alterar_estoque"))):
    item = db.query(models.Cliente).filter(models.Cliente.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    dados_atualizados = cliente.model_dump()
    dados_atualizados.pop("status", None)
    dados_atualizados["mid"] = empty_to_none(dados_atualizados.get("mid"))
    for key, value in dados_atualizados.items():
        setattr(item, key, value)

    try:
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        logger.warning("IntegrityError ao atualizar cliente")
        raise HTTPException(status_code=400, detail="MID já cadastrado.")


@router.delete("/clientes/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_cliente(item_id: int, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(exigir_permissao("alterar_estoque"))):
    item = db.query(models.Cliente).filter(models.Cliente.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    try:
        db.delete(item)
        db.commit()
    except Exception:
        logger.exception("Erro ao deletar cliente")
        db.rollback()
        raise HTTPException(status_code=400, detail="Não é possível excluir um cliente que possui dispositivos vinculados.")
    return


@router.post("/clientes/sincronizar")
def sincronizar(
    forcar: bool = False,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(exigir_permissao("alterar_estoque")),
):
    try:
        return sincronizar_clientes(db, forcar=forcar)
    except MovingpayErro as erro:
        raise HTTPException(status_code=400, detail=str(erro))
    except Exception:
        logger.exception("Erro ao sincronizar clientes da Movingpay")
        raise HTTPException(status_code=502, detail="A Movingpay não respondeu. Tente novamente.")