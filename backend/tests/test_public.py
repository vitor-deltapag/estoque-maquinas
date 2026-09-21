def test_root_publico(client):
    res = client.get("/")
    assert res.status_code == 200
    assert "mensagem" in res.json()


def test_dispositivos_sem_token_401(client):
    res = client.get("/dispositivos")
    assert res.status_code == 401


def test_clientes_sem_token_401(client):
    res = client.get("/clientes")
    assert res.status_code == 401


def test_eventos_sem_token_401(client):
    res = client.get("/eventos")
    assert res.status_code == 401


def test_token_invalido_401(client):
    res = client.get("/dispositivos", headers={"Authorization": "Bearer token-falso"})
    assert res.status_code == 401
