from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from deps import get_current_user
import models
import schemas

router = APIRouter(tags=["adquirentes"])


@router.get("/adquirentes", response_model=List[schemas.AdquirenteResponse])
def listar_adquirentes(
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    return db.query(models.Adquirente).order_by(models.Adquirente.id.desc()).all()


@router.get("/adquirentes/{item_id}", response_model=schemas.AdquirenteResponse)
def obter_adquirente(
    item_id: int,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    item = db.query(models.Adquirente).filter(models.Adquirente.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Adquirente não encontrado")
    return item


@router.post("/adquirentes", response_model=schemas.AdquirenteResponse, status_code=status.HTTP_201_CREATED)
def criar_adquirente(
    adquirente: schemas.AdquirenteCreate,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    # Usado pela página /novo-adquirente (só envia nome).
    novo = models.Adquirente(**adquirente.model_dump())
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


@router.put("/adquirentes/{item_id}", response_model=schemas.AdquirenteResponse)
def atualizar_adquirente(
    item_id: int,
    adquirente: schemas.AdquirenteCreate,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    item = db.query(models.Adquirente).filter(models.Adquirente.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Adquirente não encontrado")
    item.nome = adquirente.nome
    db.commit()
    db.refresh(item)
    return item


@router.delete("/adquirentes/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_adquirente(
    item_id: int,
    db: Session = Depends(get_db),
    user: models.DadosUsuario = Depends(get_current_user),
):
    item = db.query(models.Adquirente).filter(models.Adquirente.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Adquirente não encontrado")
    db.delete(item)
    db.commit()
    return
