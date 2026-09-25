from conftest import seed_cliente, seed_dispositivo


def test_crud_parceiro_e_maquinas_somente_leitura(client, as_comum, db_session):
    res = client.post("/parceiros", json={"nome": "Cielo", "mid": "CIO1", "nome_fantasia": "Cielo SA"})
    assert res.status_code == 201
    body = res.json()
    assert body["parceiro"] is True
    assert body["qtd_maquinas"] == 0
    pid = body["id"]

    seed_cliente(db_session, mid="COM1", nome="Comum", parceiro=False)
    lista = client.get("/parceiros")
    nomes = {p["nome"] for p in lista.json()}
    assert "Cielo" in nomes
    assert "Comum" not in nomes

    adq = db_session.get(__import__("models").Cliente, pid)
    seed_dispositivo(db_session, serial="PAR-SN1", adquirente=adq)
    detalhe = client.get(f"/parceiros/{pid}").json()
    assert detalhe["qtd_maquinas"] == 1
    assert detalhe["dispositivos"][0]["numero_serial"] == "PAR-SN1"

    # PUT não mexe no serial
    upd = client.put(f"/parceiros/{pid}", json={"nome": "Cielo Pagamentos", "mid": "CIO1"})
    assert upd.status_code == 200
    assert upd.json()["nome"] == "Cielo Pagamentos"
    assert client.get(f"/parceiros/{pid}").json()["dispositivos"][0]["numero_serial"] == "PAR-SN1"

    apagar = client.delete(f"/parceiros/{pid}")
    assert apagar.status_code == 204
    maquina = client.get("/dispositivos?search=PAR-SN1").json()[0]
    assert maquina["estado"] == "ESTOQUE"
    assert maquina["adquirente"] is None


def test_vincular_e_desvincular_maquina_do_parceiro(client, as_comum, db_session):
    parceiro = client.post("/parceiros", json={"nome": "Stone", "mid": "ST1"}).json()
    seed_dispositivo(db_session, serial="LIG1", estado="NO CLIENTE")
    pid = parceiro["id"]

    ligado = client.post(f"/parceiros/{pid}/vincular", json={"numero_serial": "lig1"})
    assert ligado.status_code == 200
    assert ligado.json()["qtd_maquinas"] == 1
    card = client.get("/dispositivos?search=LIG1").json()[0]
    assert card["adquirente"] == pid
    assert card["estado"] == "NO CLIENTE"

    solto = client.post(f"/parceiros/{pid}/desvincular", json={"numero_serial": "LIG1"})
    assert solto.status_code == 200
    assert solto.json()["qtd_maquinas"] == 0
    card = client.get("/dispositivos?search=LIG1").json()[0]
    assert card["adquirente"] is None
    assert card["estado"] == "ESTOQUE"


def test_parceiro_cliente_comum_nao_aparece(client, as_comum, db_session):
    cli = seed_cliente(db_session, mid="X1", parceiro=False)
    assert client.get(f"/parceiros/{cli.id}").status_code == 404