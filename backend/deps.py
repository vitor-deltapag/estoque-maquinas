import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
import jwt
from jwt import PyJWKClient

from database import get_db
from log import logger
import models

# auto_error=False: sem header devolvemos 401 nosso, não 403 do HTTPBearer.
bearer = HTTPBearer(auto_error=False)

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
# Chaves de assinatura atuais (ES256/RS256). /auth/v1 aqui é o GoTrue do projeto.
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
ISSUER = f"{SUPABASE_URL}/auth/v1"
_jwks_client: PyJWKClient | None = None
_JWT_LEEWAY = 30


def _jwks() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not SUPABASE_URL:
            raise HTTPException(status_code=500, detail="Servidor sem SUPABASE_URL")
        _jwks_client = PyJWKClient(JWKS_URL)
    return _jwks_client


def _email_from_payload(payload: dict) -> str | None:
    if payload.get("email"):
        return str(payload["email"])
    meta = payload.get("user_metadata")
    if isinstance(meta, dict) and meta.get("email"):
        return str(meta["email"])
    app = payload.get("app_metadata")
    if isinstance(app, dict) and app.get("email"):
        return str(app["email"])
    return None


def _decode_access_token(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    alg = header.get("alg")

    # Tokens novos do Supabase: assimétricos, validados com JWKS (não com JWT secret).
    if alg in ("ES256", "RS256"):
        key = _jwks().get_signing_key_from_jwt(token).key
        issuers = [value for value in (ISSUER, SUPABASE_URL) if value]
        return jwt.decode(
            token,
            key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=issuers,
            leeway=_JWT_LEEWAY,
        )

    # Fallback de sessões antigas. SUPABASE_JWT_SECRET é o HMAC longo, não o UUID kid.
    if alg == "HS256":
        secret = os.getenv("SUPABASE_JWT_SECRET")
        if not secret:
            raise jwt.InvalidTokenError("HS256 sem secret")
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            leeway=_JWT_LEEWAY,
        )

    raise jwt.InvalidTokenError("Algoritmo não suportado")


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> models.DadosUsuario:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")
    try:
        payload = _decode_access_token(creds.credentials)
    except jwt.PyJWTError as exc:
        logger.warning("Falha ao validar JWT: %s", type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    email = _email_from_payload(payload)
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sem e-mail")

    usuario = (
        db.query(models.DadosUsuario)
        .filter(models.DadosUsuario.email == email)
        .first()
    )
    # Primeiro acesso: cria linha COMUM em dados_usuario (Auth já existe no Supabase).
    if not usuario:
        usuario = models.DadosUsuario(
            nome=email.split("@")[0],
            email=email,
            perfil="COMUM",
            status="ATIVO",
        )
        db.add(usuario)
        db.commit()
        db.refresh(usuario)

    if (usuario.status or "").upper() == "INATIVO":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário inativo")
    return usuario


def require_admin(
    user: models.DadosUsuario = Depends(get_current_user),
) -> models.DadosUsuario:
    # Usar em /usuarios (exceto /me). COMUM autenticado ainda passa em get_current_user.
    if user.perfil != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return user
