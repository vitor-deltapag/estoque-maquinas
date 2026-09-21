from datetime import date, timedelta
from sqlalchemy.exc import IntegrityError

from conftest import seed_cliente, seed_dispositivo


def _payload(**extra):
    hoje = date.today()
    base = {
        "nome": "Feira Delta",
        "mid": "MIDEVT",
        "data_inicio": hoje.isoformat(),
        "data_fim": (hoje + timedelta(days=2)).isoformat(),
        "numero_seriais": ["EVT-A", "EVT-B"],
    }
    base.update(extra)
    return base


def test_criar_listar_obter_finalizar_evento(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDEVT", nome="Cliente Evento")
    seed_dispositivo(db_session, serial="EVT-A")
    seed_dispositivo(db_session, serial="EVT-B")

    criar = client.post("/eventos", json=_payload())
    assert criar.status_code == 201
    body = criar.json()
    assert body["situacao"] == "ABERTO"
    assert body["qtd_maquinas"] == 2
    assert body["cliente_rel"]["mid"] == "MIDEVT"
    item_id = body["id"]

    lista = client.get("/eventos")
    assert lista.status_code == 200
    assert len(lista.json()) == 1

    um = client.get(f"/eventos/{item_id}")
    assert um.status_code == 200
    assert {d["numero_serial"] for d in um.json()["dispositivos"]} == {"EVT-A", "EVT-B"}

    maq = client.get("/dispositivos?em_evento=true").json()
    assert {d["numero_serial"] for d in maq} == {"EVT-A", "EVT-B"}

    fim = client.post(f"/eventos/{item_id}/finalizar")
    assert fim.status_code == 200
    assert fim.json()["situacao"] == "FINALIZADO"
    assert fim.json()["status"] == "FINALIZADO"
    assert client.get("/dispositivos?em_evento=true").json() == []


def test_evento_pendente_apos_data_fim(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDEVT", nome="Cliente Evento")
    seed_dispositivo(db_session, serial="EVT-A")
    ontem = date.today() - timedelta(days=1)
    anteontem = date.today() - timedelta(days=2)
    res = client.post(
        "/eventos",
        json=_payload(
            data_inicio=anteontem.isoformat(),
            data_fim=ontem.isoformat(),
            numero_seriais=["EVT-A"],
        ),
    )
    assert res.status_code == 201
    assert res.json()["situacao"] == "PENDENTE"
    dash = client.get("/dispositivos/dashboard").json()
    assert dash["total_eventos_pendentes"] == 1


def test_criar_evento_serial_ignora_casing(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDEVT", nome="Cliente Evento")
    seed_dispositivo(db_session, serial="EVT-A")
    res = client.post("/eventos", json=_payload(numero_seriais=["evt-a", "EVT-A"]))
    assert res.status_code == 201
    assert res.json()["qtd_maquinas"] == 1


def test_criar_evento_validacoes(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDEVT", nome="Cliente Evento")
    seed_dispositivo(db_session, serial="EVT-A")

    datas = client.post(
        "/eventos",
        json=_payload(
            data_inicio=date.today().isoformat(),
            data_fim=(date.today() - timedelta(days=1)).isoformat(),
            numero_seriais=["EVT-A"],
        ),
    )
    assert datas.status_code == 400
    assert "término" in datas.json()["detail"]

    sem_mid = client.post("/eventos", json=_payload(mid="  ", numero_seriais=["EVT-A"]))
    assert sem_mid.status_code == 400

    mid_bad = client.post("/eventos", json=_payload(mid="NOPE", numero_seriais=["EVT-A"]))
    assert mid_bad.status_code == 400
    assert "MID" in mid_bad.json()["detail"]

    vazio = client.post("/eventos", json=_payload(numero_seriais=["  ", ""]))
    assert vazio.status_code == 400
    assert "máquina" in vazio.json()["detail"]

    serial_bad = client.post("/eventos", json=_payload(numero_seriais=["NOPE"]))
    assert serial_bad.status_code == 400
    assert "NOPE" in serial_bad.json()["detail"]


def test_criar_evento_maquina_ja_em_evento(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDEVT", nome="Cliente Evento")
    seed_dispositivo(db_session, serial="EVT-A")
    seed_dispositivo(db_session, serial="EVT-B")
    assert client.post("/eventos", json=_payload(numero_seriais=["EVT-A"])).status_code == 201
    outro = client.post("/eventos", json=_payload(nome="Outro", numero_seriais=["EVT-A", "EVT-B"]))
    assert outro.status_code == 400
    assert "EVT-A" in outro.json()["detail"]


def test_criar_evento_ignora_serial_duplicado_no_payload(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDEVT", nome="Cliente Evento")
    seed_dispositivo(db_session, serial="EVT-A")
    res = client.post("/eventos", json=_payload(numero_seriais=["EVT-A", "EVT-A", "  EVT-A  "]))
    assert res.status_code == 201
    assert res.json()["qtd_maquinas"] == 1


def test_evento_404_e_finalizar_repetido(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDEVT", nome="Cliente Evento")
    seed_dispositivo(db_session, serial="EVT-A")
    criado = client.post("/eventos", json=_payload(numero_seriais=["EVT-A"])).json()
    item_id = criado["id"]

    assert client.get("/eventos/99").status_code == 404
    assert client.post("/eventos/99/finalizar").status_code == 404

    assert client.post(f"/eventos/{item_id}/finalizar").status_code == 200
    repetido = client.post(f"/eventos/{item_id}/finalizar")
    assert repetido.status_code == 400
    assert "já foi finalizado" in repetido.json()["detail"]


def test_criar_evento_integrity(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDEVT", nome="Cliente Evento")
    seed_dispositivo(db_session, serial="EVT-A")
    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    res = client.post("/eventos", json=_payload(numero_seriais=["EVT-A"]))
    assert res.status_code == 400
    assert "evento" in res.json()["detail"]
