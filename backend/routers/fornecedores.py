from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

from database import get_db
from deps import exigir_permissao, get_current_user
from helpers import empty_to_none
from log import logger
import models
import schemas

router = APIRouter(tags=["fornecedores"])


@router.get("/fornecedores", response_model=List[schemas.FornecedorResponse])
def listar_fornecedores(db: Session = Depends(get_db), user: models.DadosUsuario = Depends(get_current_user)):
    return db.query(models.Fornecedor).all()


@router.get("/fornecedores/{item_id}", response_model=schemas.FornecedorResponse)
def obter_fornecedor(item_id: int, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(get_current_user)):
    item = db.query(models.Fornecedor).filter(models.Fornecedor.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    return item


@router.post("/fornecedores", response_model=schemas.FornecedorResponse, status_code=status.HTTP_201_CREATED)
def criar_fornecedor(fornecedor: schemas.FornecedorCreate, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(exigir_permissao("alterar_estoque"))):
    dados = fornecedor.model_dump()
    dados["codigo"] = empty_to_none(dados.get("codigo"))
    novo = models.Fornecedor(**dados)
    try:
        db.add(novo)
        db.commit()
        db.refresh(novo)
        return novo
    except IntegrityError:
        db.rollback()
        logger.warning("IntegrityError ao criar fornecedor")
        raise HTTPException(status_code=400, detail="Código já cadastrado.")


@router.put("/fornecedores/{item_id}", response_model=schemas.FornecedorResponse)
def atualizar_fornecedor(item_id: int, fornecedor: schemas.FornecedorCreate, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(exigir_permissao("alterar_estoque"))):
    item = db.query(models.Fornecedor).filter(models.Fornecedor.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")

    dados_atualizados = fornecedor.model_dump()
    dados_atualizados["codigo"] = empty_to_none(dados_atualizados.get("codigo"))
    for key, value in dados_atualizados.items():
        setattr(item, key, value)

    try:
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        logger.warning("IntegrityError ao atualizar fornecedor")
        raise HTTPException(status_code=400, detail="Código já cadastrado.")


@router.delete("/fornecedores/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_fornecedor(item_id: int, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(exigir_permissao("alterar_estoque"))):
    item = db.query(models.Fornecedor).filter(models.Fornecedor.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    try:
        db.delete(item)
        db.commit()
    except Exception:
        logger.exception("Erro ao deletar fornecedor")
        db.rollback()
        raise HTTPException(status_code=400, detail="Não é possível excluir um fornecedor que possui dispositivos vinculados.")
    return
