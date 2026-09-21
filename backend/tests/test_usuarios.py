from unittest.mock import MagicMock, patch

from sqlalchemy.exc import IntegrityError

import models


def test_usuarios_me_200(client, as_comum, user_comum):
    res = client.get("/usuarios/me")
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == user_comum.email
    assert body["perfil"] == "COMUM"


def test_listar_usuarios_comum_403(client, as_comum):
    res = client.get("/usuarios")
    assert res.status_code == 403
    assert "administradores" in res.json()["detail"]


def test_listar_usuarios_admin_200(client, as_admin, db_session):
    db_session.add(models.DadosUsuario(nome="Admin", email="admin@teste.local", perfil="ADMIN", status="ATIVO"))
    db_session.commit()
    res = client.get("/usuarios")
    assert res.status_code == 200
    assert res.json()[0]["perfil"] == "ADMIN"


def test_criar_usuario_sem_admin_api(client, as_admin):
    with patch("routers.usuarios.supabase_admin", None):
        res = client.post("/usuarios", json={"nome": "N", "email": "n@t.local", "senha": "senha123"})
    assert res.status_code == 500


def test_criar_usuario_sem_email_senha(client, as_admin):
    fake = MagicMock()
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.post("/usuarios", json={"nome": "N"})
    assert res.status_code == 400


def test_criar_usuario_erro_supabase(client, as_admin):
    fake = MagicMock()
    fake.auth.admin.create_user.side_effect = Exception("auth")
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.post("/usuarios", json={"nome": "N", "email": "n@t.local", "senha": "senha123"})
    assert res.status_code == 400
    assert "Não foi possível criar o acesso" in res.json()["detail"]


def test_criar_usuario_ok(client, as_admin):
    fake = MagicMock()
    fake.auth.admin.create_user.return_value = MagicMock(user=MagicMock(id="uid-1"))
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.post(
            "/usuarios",
            json={"nome": "Novo", "email": "novo@t.local", "senha": "senha123", "perfil": "COMUM"},
        )
    assert res.status_code == 201
    assert res.json()["email"] == "novo@t.local"


def test_criar_usuario_normaliza_email(client, as_admin):
    fake = MagicMock()
    fake.auth.admin.create_user.return_value = MagicMock(user=MagicMock(id="uid-norm"))
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.post(
            "/usuarios",
            json={"nome": "Novo", "email": "  Novo.User@T.LOCAL  ", "senha": "senha123"},
        )
    assert res.status_code == 201
    assert res.json()["email"] == "novo.user@t.local"
    fake.auth.admin.create_user.assert_called_once()
    payload = fake.auth.admin.create_user.call_args[0][0]
    assert payload["email"] == "novo.user@t.local"
    assert payload["email_confirm"] is True
    assert payload["user_metadata"]["nome"] == "Novo"


def test_criar_usuario_senha_curta(client, as_admin):
    fake = MagicMock()
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.post("/usuarios", json={"nome": "N", "email": "n@t.local", "senha": "abc123"})
    assert res.status_code == 400
    assert "8 caracteres" in res.json()["detail"]
    fake.auth.admin.create_user.assert_not_called()


def test_criar_usuario_email_invalido(client, as_admin):
    fake = MagicMock()
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.post("/usuarios", json={"nome": "N", "email": "sem-dominio", "senha": "senha123"})
    assert res.status_code == 400
    assert "e-mail válido" in res.json()["detail"]
    fake.auth.admin.create_user.assert_not_called()


def test_criar_usuario_perfil_invalido(client, as_admin):
    fake = MagicMock()
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.post(
            "/usuarios",
            json={"nome": "N", "email": "n@t.local", "senha": "senha123", "perfil": "SUPER"},
        )
    assert res.status_code == 400
    assert "Perfil inválido" in res.json()["detail"]
    fake.auth.admin.create_user.assert_not_called()


def test_criar_usuario_email_ja_na_tabela(client, as_admin, db_session):
    db_session.add(models.DadosUsuario(nome="Já", email="Dup@T.local", perfil="COMUM", status="ATIVO"))
    db_session.commit()
    fake = MagicMock()
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.post("/usuarios", json={"nome": "N", "email": "dup@t.local", "senha": "senha123"})
    assert res.status_code == 400
    assert "E-mail já cadastrado" in res.json()["detail"]
    fake.auth.admin.create_user.assert_not_called()


def test_criar_usuario_supabase_ja_existe(client, as_admin):
    fake = MagicMock()
    fake.auth.admin.create_user.side_effect = Exception("User already registered")
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.post("/usuarios", json={"nome": "N", "email": "n@t.local", "senha": "senha123"})
    assert res.status_code == 400
    assert res.json()["detail"] == "E-mail já cadastrado no login."


def test_criar_usuario_email_duplicado(client, as_admin, db_session):
    fake = MagicMock()
    fake.auth.admin.create_user.return_value = MagicMock(user=MagicMock(id="uid-2"))
    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.post("/usuarios", json={"nome": "N", "email": "dup@t.local", "senha": "senha123"})
    assert res.status_code == 400
    assert "E-mail" in res.json()["detail"]
    fake.auth.admin.delete_user.assert_called_with("uid-2")


def test_criar_usuario_erro_banco(client, as_admin, db_session):
    fake = MagicMock()
    fake.auth.admin.create_user.return_value = MagicMock(user=MagicMock(id="uid-3"))
    original = db_session.commit
    db_session.commit = lambda: (_ for _ in ()).throw(RuntimeError("falha"))
    try:
        with patch("routers.usuarios.supabase_admin", fake):
            res = client.post("/usuarios", json={"nome": "N", "email": "x@t.local", "senha": "senha123"})
    finally:
        db_session.commit = original
    assert res.status_code == 400
    assert "banco" in res.json()["detail"]
    fake.auth.admin.delete_user.assert_called_with("uid-3")


def test_criar_usuario_integrity_sem_auth_id(client, as_admin, db_session):
    fake = MagicMock()
    fake.auth.admin.create_user.return_value = MagicMock(user=MagicMock(id=None))
    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.post("/usuarios", json={"nome": "N", "email": "z@t.local", "senha": "senha123"})
    assert res.status_code == 400
    fake.auth.admin.delete_user.assert_not_called()


def test_criar_usuario_erro_banco_sem_auth_id(client, as_admin, db_session):
    fake = MagicMock()
    fake.auth.admin.create_user.return_value = MagicMock(user=MagicMock(id=None))
    original = db_session.commit
    db_session.commit = lambda: (_ for _ in ()).throw(RuntimeError("falha"))
    try:
        with patch("routers.usuarios.supabase_admin", fake):
            res = client.post("/usuarios", json={"nome": "N", "email": "z2@t.local", "senha": "senha123"})
    finally:
        db_session.commit = original
    assert res.status_code == 400
    fake.auth.admin.delete_user.assert_not_called()


def test_atualizar_usuario(client, as_admin, db_session):
    user = models.DadosUsuario(nome="Old", email="old@t.local", perfil="COMUM", status="ATIVO")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    res = client.put(
        f"/usuarios/{user.id}",
        json={"nome": "New", "nome_fantasia": "NF", "status": "ATIVO", "perfil": "ADMIN"},
    )
    assert res.status_code == 200
    assert res.json()["nome"] == "New"
    assert res.json()["perfil"] == "ADMIN"


def test_atualizar_usuario_404(client, as_admin):
    res = client.put("/usuarios/99", json={"nome": "X"})
    assert res.status_code == 404


def test_atualizar_usuario_erro_banco(client, as_admin, db_session):
    user = models.DadosUsuario(nome="Old", email="u@t.local", perfil="COMUM", status="ATIVO")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    original = db_session.commit
    db_session.commit = lambda: (_ for _ in ()).throw(RuntimeError("falha"))
    try:
        res = client.put(f"/usuarios/{user.id}", json={"nome": "X"})
    finally:
        db_session.commit = original
    assert res.status_code == 400


def test_deletar_proprio_usuario(client, as_admin, user_admin):
    res = client.delete(f"/usuarios/{user_admin.id}")
    assert res.status_code == 400


def test_deletar_usuario_404(client, as_admin):
    assert client.delete("/usuarios/99").status_code == 404


def test_deletar_usuario_ok(client, as_admin, db_session):
    user = models.DadosUsuario(nome="Del", email="del@t.local", perfil="COMUM", status="ATIVO")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    auth_user = MagicMock()
    auth_user.email = "del@t.local"
    auth_user.id = "uid-del"
    fake = MagicMock()
    fake.auth.admin.list_users.return_value = [auth_user]
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.delete(f"/usuarios/{user.id}")
    assert res.status_code == 204
    fake.auth.admin.delete_user.assert_called_with("uid-del")


def test_deletar_usuario_sem_supabase(client, as_admin, db_session):
    user = models.DadosUsuario(nome="Del", email="nosb@t.local", perfil="COMUM", status="ATIVO")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    with patch("routers.usuarios.supabase_admin", None):
        res = client.delete(f"/usuarios/{user.id}")
    assert res.status_code == 204


def test_deletar_usuario_sem_email(client, as_admin, db_session):
    user = models.DadosUsuario(nome="Del", email=None, perfil="COMUM", status="ATIVO")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    fake = MagicMock()
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.delete(f"/usuarios/{user.id}")
    assert res.status_code == 204
    fake.auth.admin.list_users.assert_not_called()
    user = models.DadosUsuario(nome="Del", email="err@t.local", perfil="COMUM", status="ATIVO")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    fake = MagicMock()
    fake.auth.admin.list_users.side_effect = Exception("auth")
    with patch("routers.usuarios.supabase_admin", fake):
        res = client.delete(f"/usuarios/{user.id}")
    assert res.status_code == 400
