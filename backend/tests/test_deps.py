from fastapi import HTTPException
import jwt
import pytest
from unittest.mock import MagicMock, patch

import deps
import models


def _hs256(payload: dict) -> str:
    return jwt.encode(payload, "test-jwt-secret-32-bytes-minimum!!", algorithm="HS256")


def test_header_nao_bearer_401(client):
    res = client.get("/dispositivos", headers={"Authorization": "Token abc"})
    assert res.status_code == 401


def test_hs256_cria_usuario_no_primeiro_acesso(client, db_session):
    token = _hs256({"email": "novo@teste.local", "aud": "authenticated"})
    res = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "novo@teste.local"
    assert body["perfil"] == "COMUM"
    assert db_session.query(models.DadosUsuario).filter_by(email="novo@teste.local").one()


def test_hs256_email_em_user_metadata(client, db_session):
    db_session.add(models.DadosUsuario(nome="Meta", email="meta@teste.local", perfil="COMUM", status="ATIVO"))
    db_session.commit()
    token = _hs256({"aud": "authenticated", "user_metadata": {"email": "meta@teste.local"}})
    res = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "meta@teste.local"


def test_hs256_email_em_app_metadata(client, db_session):
    db_session.add(models.DadosUsuario(nome="App", email="app@teste.local", perfil="COMUM", status="ATIVO"))
    db_session.commit()
    token = _hs256({"aud": "authenticated", "app_metadata": {"email": "app@teste.local"}})
    res = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "app@teste.local"


def test_usuario_inativo_403(client, db_session):
    db_session.add(models.DadosUsuario(nome="Off", email="off@teste.local", perfil="COMUM", status="INATIVO"))
    db_session.commit()
    token = _hs256({"email": "off@teste.local", "aud": "authenticated"})
    res = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_token_sem_email_401(client):
    token = _hs256({"aud": "authenticated"})
    res = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert res.json()["detail"] == "Token sem e-mail"


def test_hs256_sem_secret(client, monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    token = _hs256({"email": "a@b.com", "aud": "authenticated"})
    res = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_algoritmo_nao_suportado_401(client):
    token = jwt.encode({"email": "a@b.com", "aud": "authenticated"}, "test-jwt-secret-32-bytes-minimum!!", algorithm="HS256")
    with patch("deps.jwt.get_unverified_header", return_value={"alg": "none"}):
        res = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_jwt_invalido_registra_aviso(client, caplog):
    token = jwt.encode({"email": "a@b.com", "aud": "authenticated"}, "wrong-jwt-secret-32-bytes-minimum!!", algorithm="HS256")
    with caplog.at_level("WARNING"):
        res = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert "Falha ao validar JWT" in caplog.text


def test_es256_com_jwks(client, db_session):
    db_session.add(models.DadosUsuario(nome="ES", email="es@teste.local", perfil="COMUM", status="ATIVO"))
    db_session.commit()
    jwks = MagicMock()
    jwks.get_signing_key_from_jwt.return_value.key = "k"
    with (
        patch("deps.jwt.get_unverified_header", return_value={"alg": "ES256"}),
        patch("deps._jwks", return_value=jwks),
        patch("deps.jwt.decode", return_value={"email": "es@teste.local", "aud": "authenticated"}),
    ):
        res = client.get("/usuarios/me", headers={"Authorization": "Bearer fake-es256"})
    assert res.status_code == 200
    assert res.json()["email"] == "es@teste.local"


def test_jwks_sem_supabase_url():
    deps._jwks_client = None
    with patch.object(deps, "SUPABASE_URL", ""):
        with pytest.raises(HTTPException) as exc:
            deps._jwks()
    assert exc.value.status_code == 500
    deps._jwks_client = None


def test_jwks_cacheia_cliente():
    deps._jwks_client = None
    fake = MagicMock()
    with patch("deps.PyJWKClient", return_value=fake) as ctor:
        assert deps._jwks() is fake
        assert deps._jwks() is fake
        ctor.assert_called_once()
    deps._jwks_client = None
