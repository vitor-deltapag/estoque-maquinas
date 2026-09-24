from conftest import seed_cliente, seed_dispositivo, seed_fornecedor


def test_crud_adquirentes(client, as_comum):
    criar = client.post("/adquirentes", json={"nome": "Cielo"})
    assert criar.status_code == 201
    item_id = criar.json()["id"]

    lista = client.get("/adquirentes")
    assert lista.status_code == 200
    assert lista.json()[0]["nome"] == "Cielo"

    um = client.get(f"/adquirentes/{item_id}")
    assert um.status_code == 200
    assert um.json()["nome"] == "Cielo"

    upd = client.put(f"/adquirentes/{item_id}", json={"nome": "Rede"})
    assert upd.status_code == 200
    assert upd.json()["nome"] == "Rede"

    apagar = client.delete(f"/adquirentes/{item_id}")
    assert apagar.status_code == 204
    assert client.get(f"/adquirentes/{item_id}").status_code == 404


def test_adquirente_404(client, as_comum):
    assert client.get("/adquirentes/99").status_code == 404
    assert client.put("/adquirentes/99", json={"nome": "X"}).status_code == 404
    assert client.delete("/adquirentes/99").status_code == 404


def test_crud_fornecedores(client, as_comum):
    criar = client.post("/fornecedores", json={"nome": "Acme", "codigo": "A1", "status": "ATIVO"})
    assert criar.status_code == 201
    item_id = criar.json()["id"]

    assert client.get("/fornecedores").status_code == 200
    assert client.get(f"/fornecedores/{item_id}").json()["codigo"] == "A1"

    upd = client.put(
        f"/fornecedores/{item_id}",
        json={"nome": "Acme", "codigo": "  ", "status": "ATIVO"},
    )
    assert upd.status_code == 200
    assert upd.json()["codigo"] is None

    assert client.delete(f"/fornecedores/{item_id}").status_code == 204


def test_fornecedor_404(client, as_comum):
    assert client.get("/fornecedores/99").status_code == 404
    assert client.put("/fornecedores/99", json={"nome": "X"}).status_code == 404
    assert client.delete("/fornecedores/99").status_code == 404


def test_deletar_fornecedor_com_dispositivo_400(client, as_comum, db_session):
    forn = seed_fornecedor(db_session)

    def boom(_obj):
        raise Exception("fk")

    db_session.delete = boom
    res = client.delete(f"/fornecedores/{forn.id}")
    assert res.status_code == 400


def test_fornecedor_codigo_duplicado_ao_criar(client, as_comum, db_session):
    from sqlalchemy.exc import IntegrityError

    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    res = client.post("/fornecedores", json={"nome": "X", "codigo": "DUP"})
    assert res.status_code == 400
    assert res.json()["detail"] == "Código já cadastrado."


def test_fornecedor_codigo_duplicado_ao_atualizar(client, as_comum, db_session):
    from sqlalchemy.exc import IntegrityError

    forn = seed_fornecedor(db_session)
    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    res = client.put(f"/fornecedores/{forn.id}", json={"nome": "X", "codigo": "Z"})
    assert res.status_code == 400


def test_crud_clientes_e_busca(client, as_comum, db_session):
    criar = client.post(
        "/clientes",
        json={"nome": "Loja Alpha", "nome_fantasia": "Alpha", "mid": "  MID9  ", "status": "ATIVO"},
    )
    assert criar.status_code == 201
    item_id = criar.json()["id"]
    assert criar.json()["mid"] == "MID9"
    assert criar.json()["status"] is None
    assert criar.json()["parceiro"] is False

    lista = client.get("/clientes?search=alpha")
    assert lista.status_code == 200
    assert len(lista.json()) == 1

    um = client.get(f"/clientes/{item_id}")
    assert um.status_code == 200

    upd = client.put(
        f"/clientes/{item_id}",
        json={"nome": "Loja Beta", "nome_fantasia": "Beta", "mid": "", "status": "ATIVO"},
    )
    assert upd.status_code == 200
    assert upd.json()["mid"] is None
    assert upd.json()["status"] is None

    assert client.delete(f"/clientes/{item_id}").status_code == 204


def test_put_cliente_nao_altera_status_movingpay(client, as_comum, db_session):
    cli = seed_cliente(db_session, mid="MIDS", nome="Loja")
    cli.status = "BLOQUEADO"
    db_session.commit()
    res = client.put(
        f"/clientes/{cli.id}",
        json={"nome": "Loja", "nome_fantasia": "X", "mid": "MIDS", "status": "ATIVO", "parceiro": False},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "BLOQUEADO"


def test_cliente_mostra_distribuidor_das_maquinas(client, as_comum, db_session):
    cli = seed_cliente(db_session, mid="MIDD", nome="Loja Dist")
    forn = seed_fornecedor(db_session, nome="Rede Norte", codigo="RN")
    seed_dispositivo(db_session, serial="DIST1", cliente=cli, fornecedor=forn, estado="NO CLIENTE")
    res = client.get(f"/clientes/{cli.id}")
    assert res.status_code == 200
    assert res.json()["distribuidor_nome"] == "Rede Norte"
    lista = client.get("/clientes?search=MIDD")
    assert lista.json()[0]["distribuidor_nome"] == "Rede Norte"


def test_cliente_404(client, as_comum):
    assert client.get("/clientes/99").status_code == 404
    assert client.put("/clientes/99", json={"nome": "X"}).status_code == 404
    assert client.delete("/clientes/99").status_code == 404


def test_deletar_cliente_com_dispositivo_400(client, as_comum, db_session):
    cli = seed_cliente(db_session)

    def boom(_obj):
        raise Exception("fk")

    db_session.delete = boom
    res = client.delete(f"/clientes/{cli.id}")
    assert res.status_code == 400


def test_criar_cliente_mid_duplicado_400(client, as_comum, db_session):
    from sqlalchemy.exc import IntegrityError

    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    res = client.post("/clientes", json={"nome": "Loja", "mid": "111"})
    assert res.status_code == 400
    assert res.json()["detail"] == "MID já cadastrado."


def test_atualizar_cliente_mid_duplicado_400(client, as_comum, db_session):
    from sqlalchemy.exc import IntegrityError

    cli = seed_cliente(db_session)
    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    res = client.put(f"/clientes/{cli.id}", json={"nome": "Loja", "mid": "222"})
    assert res.status_code == 400


def test_cliente_tag_parceiro(client, as_comum, db_session):
    parceiro = client.post(
        "/clientes",
        json={"nome": "Cielo", "mid": "CIO1", "parceiro": True},
    )
    assert parceiro.status_code == 201
    assert parceiro.json()["parceiro"] is True
    seed_cliente(db_session, mid="COM1", nome="Comum", parceiro=False)

    so_parceiro = client.get("/clientes?parceiro=true")
    assert so_parceiro.status_code == 200
    nomes = {c["nome"] for c in so_parceiro.json()}
    assert "Cielo" in nomes
    assert "Comum" not in nomes

    so_comum = client.get("/clientes?parceiro=false")
    assert "Comum" in {c["nome"] for c in so_comum.json()}
    assert "Cielo" not in {c["nome"] for c in so_comum.json()}
