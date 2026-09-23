from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from typing import List, Optional

from database import get_db
from deps import get_current_user
from helpers import empty_to_none
from log import logger
import models
import schemas

router = APIRouter(tags=["movimentacoes"])



@router.get("/movimentacoes/resumo")
def obter_resumo(semana: date | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return resumo_semana(db, semana or date.today())