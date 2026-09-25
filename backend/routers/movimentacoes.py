from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from deps import exigir_permissao
from movimentacoes import consulta_maquina, resumo_semana

router = APIRouter(tags=["movimentacoes"])


@router.get("/movimentacoes/resumo")
def obter_resumo(semana: date | None = None, db: Session = Depends(get_db), user=Depends(exigir_permissao("ver_movimentacoes"))):
    return resumo_semana(db, semana or date.today())


@router.get("/movimentacoes/maquina")
def obter_maquina(serial: str = "", db: Session = Depends(get_db), user=Depends(exigir_permissao("ver_movimentacoes"))):
    limpo = serial.strip().upper()
    if not limpo:
        raise HTTPException(status_code=400, detail="Informe o serial da máquina.")
    resultado = consulta_maquina(db, limpo)
    if resultado is None:
        raise HTTPException(status_code=404, detail="Máquina não encontrada.")
    return resultado