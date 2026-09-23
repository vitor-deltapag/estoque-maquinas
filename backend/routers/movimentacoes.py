from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user
from movimentacoes import resumo_semana

router = APIRouter(tags=["movimentacoes"])


@router.get("/movimentacoes/resumo")
def obter_resumo(semana: date | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return resumo_semana(db, semana or date.today())