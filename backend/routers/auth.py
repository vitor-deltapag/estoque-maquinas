from fastapi import APIRouter, HTTPException, Request, status
import schemas
from limiter import limiter
from log import logger
from supabase_admin import supabase_anon

# Sem prefixo /auth/v1: isso é a API GoTrue do Supabase, não desta FastAPI.
router = APIRouter(tags=["auth"])


@router.post("/login", response_model=schemas.LoginResponse)
@limiter.limit("5/minute")
def login(request: Request, dados: schemas.LoginRequest):
    """Público. UI e Apidog: e-mail+senha → JWT. Rate limit 5/min por IP (inclui senha vazia)."""
    if not supabase_anon:
        raise HTTPException(status_code=500, detail="Supabase Auth não está configurado")
    if not dados.email.strip() or not dados.senha:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
        )
    try:
        res = supabase_anon.auth.sign_in_with_password({
            "email": dados.email,
            "password": dados.senha,
        })
    except Exception:
        logger.warning("Falha no login")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
        )
    if not res.session or not res.session.access_token or not res.session.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
        )
    return {
        "access_token": res.session.access_token,
        "refresh_token": res.session.refresh_token,
        "token_type": "bearer",  # nosec B105
    }
