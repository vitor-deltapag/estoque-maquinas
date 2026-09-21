from unittest.mock import MagicMock, patch


def test_login_senha_vazia_401(client):
    res = client.post("/login", json={"email": "a@b.com", "senha": ""})
    assert res.status_code == 401
    assert res.json()["detail"] == "E-mail ou senha incorretos."


def test_login_credenciais_invalidas_401(client):
    fake = MagicMock()
    fake.auth.sign_in_with_password.side_effect = Exception("auth")
    with patch("routers.auth.supabase_anon", fake):
        res = client.post("/login", json={"email": "a@b.com", "senha": "errada"})
    assert res.status_code == 401
    assert res.json()["detail"] == "E-mail ou senha incorretos."


def test_login_sucesso_devolve_tokens(client):
    session = MagicMock()
    session.access_token = "access-test"
    session.refresh_token = "refresh-test"
    fake = MagicMock()
    fake.auth.sign_in_with_password.return_value = MagicMock(session=session)
    with patch("routers.auth.supabase_anon", fake):
        res = client.post("/login", json={"email": "ok@teste.local", "senha": "secreta"})
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"] == "access-test"
    assert body["refresh_token"] == "refresh-test"
    assert body["token_type"] == "bearer"


def test_login_sem_supabase_500(client):
    with patch("routers.auth.supabase_anon", None):
        res = client.post("/login", json={"email": "a@b.com", "senha": "x"})
    assert res.status_code == 500


def test_login_sem_sessao_401(client):
    fake = MagicMock()
    fake.auth.sign_in_with_password.return_value = MagicMock(session=None)
    with patch("routers.auth.supabase_anon", fake):
        res = client.post("/login", json={"email": "a@b.com", "senha": "x"})
    assert res.status_code == 401


def test_login_sem_refresh_token_401(client):
    session = MagicMock()
    session.access_token = "a"
    session.refresh_token = None
    fake = MagicMock()
    fake.auth.sign_in_with_password.return_value = MagicMock(session=session)
    with patch("routers.auth.supabase_anon", fake):
        res = client.post("/login", json={"email": "a@b.com", "senha": "x"})
    assert res.status_code == 401


def test_login_rate_limit_429(client):
    fake = MagicMock()
    fake.auth.sign_in_with_password.side_effect = Exception("auth")
    with patch("routers.auth.supabase_anon", fake):
        statuses = []
        for _ in range(6):
            res = client.post("/login", json={"email": "a@b.com", "senha": "errada"})
            statuses.append(res.status_code)
    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] == 429
    assert "Muitas tentativas" in res.json()["detail"]
