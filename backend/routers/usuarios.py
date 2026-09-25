from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from typing import List

from database import get_db
from deps import get_current_user, require_admin
from permissoes import gravar_permissoes, normalizar_perfil
from helpers import empty_to_none
from log import logger
from supabase_admin import supabase_admin
import models
import schemas

router = APIRouter(tags=["usuarios"])

SENHA_MIN = 8
PERFIS = {"ADMIN", "OPERACIONAL", "COMERCIAL"}
STATUSES = {"ATIVO", "INATIVO"}


def _normalizar_email(email: str | None) -> str | None:
    valor = empty_to_none(email)
    return valor.lower() if valor else None


def _validar_acesso(usuario: schemas.DadosUsuarioCreate, *, exigir_senha: bool):
    nome = empty_to_none(usuario.nome)
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome completo.")
    email = _normalizar_email(usuario.email)
    senha = usuario.senha or ""
    if exigir_senha:
        if not email or not senha:
            raise HTTPException(status_code=400, detail="E-mail e senha são obrigatórios.")
        if "@" not in email or "." not in email.split("@")[-1]:
            raise HTTPException(status_code=400, detail="Informe um e-mail válido.")
        if len(senha) < SENHA_MIN:
            raise HTTPException(
                status_code=400,
                detail=f"A senha provisória precisa ter pelo menos {SENHA_MIN} caracteres.",
            )
    perfil = normalizar_perfil(usuario.perfil)
    if (usuario.perfil or "").strip().upper() not in PERFIS | {"COMUM", ""}:
        raise HTTPException(status_code=400, detail="Perfil inválido. Use ADMIN, OPERACIONAL ou COMERCIAL.")
    status_user = (usuario.status or "ATIVO").strip().upper()
    if status_user not in STATUSES:
        raise HTTPException(status_code=400, detail="Status inválido. Use ATIVO ou INATIVO.")
    return {
        "nome": nome,
        "nome_fantasia": empty_to_none(usuario.nome_fantasia),
        "email": email,
        "senha": senha,
        "perfil": perfil,
        "status": status_user,
        "permissoes": gravar_permissoes(perfil, usuario.permissoes),
    }


def _erro_supabase(exc: Exception) -> str:
    texto = str(exc).lower()
    if "already" in texto or "registered" in texto or "exists" in texto or "duplicate" in texto:
        return "E-mail já cadastrado no login."
    logger.exception("Erro ao criar usuário no Supabase")
    return "Não foi possível criar o acesso. Tente outro e-mail."


@router.get("/usuarios", response_model=List[schemas.DadosUsuarioResponse])
def listar_usuarios(db: Session = Depends(get_db), user: models.DadosUsuario = Depends(require_admin)):
    return db.query(models.DadosUsuario).all()


@router.post("/usuarios", response_model=schemas.DadosUsuarioResponse, status_code=status.HTTP_201_CREATED)
def criar_usuario(usuario: schemas.DadosUsuarioCreate, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(require_admin)):
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase Admin API não está configurada")
    dados = _validar_acesso(usuario, exigir_senha=True)

    existente = (
        db.query(models.DadosUsuario)
        .filter(func.lower(models.DadosUsuario.email) == dados["email"])
        .first()
    )
    if existente:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    auth_user_id = None
    try:
        res = supabase_admin.auth.admin.create_user({
            "email": dados["email"],
            "password": dados["senha"],
            "email_confirm": True,
            "user_metadata": {"nome": dados["nome"]},
        })
        auth_user_id = res.user.id if res.user else None
    except Exception as exc:
        raise HTTPException(status_code=400, detail=_erro_supabase(exc))

    novo = models.DadosUsuario(
        nome=dados["nome"],
        nome_fantasia=dados["nome_fantasia"],
        email=dados["email"],
        perfil=dados["perfil"],
        status=dados["status"],
        permissoes=dados["permissoes"],
    )
    try:
        db.add(novo)
        db.commit()
        db.refresh(novo)
        return novo
    except IntegrityError:
        db.rollback()
        if auth_user_id:
            supabase_admin.auth.admin.delete_user(auth_user_id)
        logger.warning("IntegrityError ao criar usuário")
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")
    except Exception:
        db.rollback()
        if auth_user_id:
            supabase_admin.auth.admin.delete_user(auth_user_id)
        logger.exception("Erro ao salvar usuário no banco")
        raise HTTPException(status_code=400, detail="Erro ao salvar usuário no banco")


# Única rota de /usuarios para COMUM. O resto usa require_admin.
@router.get("/usuarios/me", response_model=schemas.DadosUsuarioResponse)
def obter_meu_perfil(user: models.DadosUsuario = Depends(get_current_user)):
    return user


@router.put("/usuarios/{item_id}", response_model=schemas.DadosUsuarioResponse)
def atualizar_usuario(item_id: int, usuario: schemas.DadosUsuarioCreate, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(require_admin)):
    item = db.query(models.DadosUsuario).filter(models.DadosUsuario.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    dados = _validar_acesso(usuario, exigir_senha=False)
    item.nome = dados["nome"]
    item.nome_fantasia = dados["nome_fantasia"]
    item.status = dados["status"]
    item.perfil = dados["perfil"]
    item.permissoes = dados["permissoes"]

    try:
        db.commit()
        db.refresh(item)
        return item
    except Exception:
        db.rollback()
        logger.exception("Erro ao atualizar usuário")
        raise HTTPException(status_code=400, detail="Erro ao atualizar usuário")


@router.delete("/usuarios/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_usuario(item_id: int, db: Session = Depends(get_db), user: models.DadosUsuario = Depends(require_admin)):
    if item_id == user.id:
        raise HTTPException(status_code=400, detail="Não é possível excluir o próprio usuário.")
    item = db.query(models.DadosUsuario).filter(models.DadosUsuario.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if supabase_admin and item.email:
        try:
            users = supabase_admin.auth.admin.list_users()
            for u in users:
                if u.email == item.email:
                    supabase_admin.auth.admin.delete_user(u.id)
                    break
        except Exception:
            db.rollback()
            logger.exception("Erro ao deletar usuário no Supabase")
            raise HTTPException(status_code=400, detail="Erro ao deletar usuário no Supabase")

    db.delete(item)
    db.commit()
    return
