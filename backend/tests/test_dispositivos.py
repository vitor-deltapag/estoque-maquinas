from sqlalchemy.exc import IntegrityError
import pytest

from conftest import seed_cliente, seed_dispositivo, seed_fornecedor
import models


def test_listar_e_buscar_dispositivos(client, as_comum, db_session):
    cli = seed_cliente(db_session, mid="MIDX")
    seed_dispositivo(db_session, serial="ABC123", cliente=cli)
    seed_dispositivo(db_session, serial="ZZZ999")

    lista = client.get("/dispositivos")
    assert lista.status_code == 200
    assert len(lista.json()) == 2

    por_serial = client.get("/dispositivos?search=ABC")
    assert len(por_serial.json()) == 1

    por_mid = client.get("/dispositivos?search=MIDX")
    assert len(por_mid.json()) == 1


def test_dashboard(client, as_comum, db_session):
    from models import Dispositivo

    seed_cliente(db_session)
    seed_fornecedor(db_session)
    seed_dispositivo(db_session, serial="S1", estado="ESTOQUE")
    seed_dispositivo(db_session, serial="S2", estado="NO CLIENTE")
    sem_modelo = Dispositivo(modelo=None, numero_serial="SEM1", estado=None)
    db_session.add(sem_modelo)
    db_session.commit()

    db_session.add(models.DadosUsuario(nome="U1", email="u1@teste.local", perfil="COMUM", status="ATIVO"))
    db_session.add(models.DadosUsuario(nome="U2", email="u2@teste.local", perfil="ADMIN", status="ATIVO"))
    db_session.commit()

    res = client.get("/dispositivos/dashboard")
    assert res.status_code == 200
    body = res.json()
    assert body["total_maquinas"] >= 2
    assert body["total_clientes"] >= 1
    assert "agrupamento_modelos" in body
    assert "Sem Modelo" in body["agrupamento_modelos"]
    assert body["total_parceiro"] == 0
    assert body["total_evento"] == 0
    assert body["total_eventos_pendentes"] == 0
    assert body["total_usuarios"] == 2


def test_dashboard_conta_parceiro_e_evento(client, as_comum, db_session):
    adq = seed_cliente(db_session, mid="PAR1", nome="Cielo", parceiro=True)
    seed_dispositivo(db_session, serial="P1", adquirente=adq)
    seed_dispositivo(db_session, serial="E1", em_evento=True)
    seed_dispositivo(db_session, serial="X1")

    body = client.get("/dispositivos/dashboard").json()
    assert body["total_parceiro"] == 1
    assert body["total_evento"] == 1


def test_filtrar_dispositivos_evento_e_parceiro(client, as_comum, db_session):
    adq = seed_cliente(db_session, mid="PAR2", nome="Rede", parceiro=True)
    seed_dispositivo(db_session, serial="EV1", em_evento=True)
    seed_dispositivo(db_session, serial="PAR1", adquirente=adq)
    seed_dispositivo(db_session, serial="N1")

    em_evento = client.get("/dispositivos?em_evento=true")
    assert em_evento.status_code == 200
    assert [d["numero_serial"] for d in em_evento.json()] == ["EV1"]

    sem_evento = client.get("/dispositivos?em_evento=false")
    assert {d["numero_serial"] for d in sem_evento.json()} == {"PAR1", "N1"}

    com_parceiro = client.get("/dispositivos?parceiro=true")
    assert [d["numero_serial"] for d in com_parceiro.json()] == ["PAR1"]

    sem_parceiro = client.get("/dispositivos?parceiro=false")
    assert {d["numero_serial"] for d in sem_parceiro.json()} == {"EV1", "N1"}


def test_filtrar_dispositivos_modelo_estado_aquisicao(client, as_comum, db_session):
    seed_dispositivo(db_session, serial="A1", modelo="P2 BIN", estado="NO CLIENTE", aquisicao="ALUGADA")
    seed_dispositivo(db_session, serial="B1", modelo="X990", estado="NO CLIENTE", aquisicao="ALUGADA")
    seed_dispositivo(db_session, serial="C1", modelo="P2 BIN", estado="ESTOQUE", aquisicao="COMPRADA")

    por_modelo = client.get("/dispositivos", params={"modelo": "P2 BIN"})
    assert {d["numero_serial"] for d in por_modelo.json()} == {"A1", "C1"}

    combinado = client.get(
        "/dispositivos",
        params={"modelo": "P2 BIN", "estado": "NO CLIENTE", "aquisicao": "ALUGADA"},
    )
    assert [d["numero_serial"] for d in combinado.json()] == ["A1"]

    por_aquisicao = client.get("/dispositivos", params={"aquisicao": "COMPRADA"})
    assert [d["numero_serial"] for d in por_aquisicao.json()] == ["C1"]


def test_filtrar_dispositivos_aquisicao_invalida(client, as_comum):
    res = client.get("/dispositivos", params={"aquisicao": "DOADA"})
    assert res.status_code == 400


def test_criar_dispositivo_ok(client, as_comum, db_session):
    cli = seed_cliente(db_session, mid="MIDC")
    forn = seed_fornecedor(db_session, nome="FornX")
    res = client.post(
        "/dispositivos",
        json={
            "modelo": "D175",
            "numero_serial": "SN-NEW",
            "estado": "NO CLIENTE", "aquisicao": "ALUGADA",
            "mid": "MIDC",
            "fornecedor_nome": "FornX",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["numero_serial"] == "SN-NEW"
    assert body["cliente"] == cli.id
    assert body["fornecedor"] == forn.id
    assert body["aquisicao"] == "ALUGADA"


def test_criar_dispositivo_serial_duplicado(client, as_comum, db_session):
    seed_dispositivo(db_session, serial="DUP1")
    res = client.post("/dispositivos", json={"numero_serial": "DUP1", "modelo": "X", "estado": "ESTOQUE", "aquisicao": "ALUGADA"})
    assert res.status_code == 400
    assert "já está cadastrado" in res.json()["detail"]


def test_criar_dispositivo_cliente_inativo(client, as_comum, db_session):
    cli = seed_cliente(db_session, mid="MIDOFF", nome="Loja Parada")
    cli.status = "BLOQUEADO"
    db_session.commit()
    res = client.post("/dispositivos", json={"mid": "MIDOFF", "numero_serial": "S-OFF", "modelo": "X", "estado": "NO CLIENTE", "aquisicao": "ALUGADA"})
    assert res.status_code == 400
    assert "inativo" in res.json()["detail"]


def test_atualizar_mantem_cliente_inativo_ja_vinculado(client, as_comum, db_session):
    cli = seed_cliente(db_session, mid="MIDKEEP", nome="Loja Antiga")
    disp = seed_dispositivo(db_session, serial="KEEP1", cliente=cli)
    cli.status = "DESCREDENCIADO"
    db_session.commit()
    res = client.put(f"/dispositivos/{disp.id}", json={"mid": "MIDKEEP", "numero_serial": "KEEP1", "modelo": "X", "estado": "NO CLIENTE", "aquisicao": "ALUGADA"})
    assert res.status_code == 200


def test_criar_dispositivo_mid_inexistente(client, as_comum):
    res = client.post("/dispositivos", json={"mid": "NAO", "numero_serial": "S9", "modelo": "X", "estado": "NO CLIENTE", "aquisicao": "ALUGADA"})
    assert res.status_code == 400
    assert "MID" in res.json()["detail"]


def test_criar_dispositivo_fornecedor_inexistente(client, as_comum):
    res = client.post("/dispositivos", json={"fornecedor_nome": "NaoExiste", "numero_serial": "S8", "modelo": "X", "estado": "ESTOQUE", "aquisicao": "ALUGADA"})
    assert res.status_code == 400


def test_criar_dispositivo_com_parceiro(client, as_comum, db_session):
    adq = seed_cliente(db_session, mid="PARC", nome="Cielo", parceiro=True)
    res = client.post(
        "/dispositivos",
        json={
            "modelo": "D175",
            "numero_serial": "SN-PAR",
            "estado": "ESTOQUE", "aquisicao": "ALUGADA",
            "adquirente_nome": "Cielo",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["adquirente"] == adq.id
    assert body["adquirente_rel"]["nome"] == "Cielo"


def test_criar_dispositivo_parceiro_inexistente(client, as_comum):
    res = client.post("/dispositivos", json={"adquirente_nome": "NaoExiste", "numero_serial": "S-P", "modelo": "X", "estado": "ESTOQUE", "aquisicao": "ALUGADA"})
    assert res.status_code == 400
    assert "Parceiro" in res.json()["detail"]


def test_criar_dispositivo_integrity_com_serial(client, as_comum, db_session):
    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    res = client.post("/dispositivos", json={"numero_serial": "S7", "modelo": "X", "estado": "ESTOQUE", "aquisicao": "ALUGADA"})
    assert res.status_code == 400
    assert "S7" in res.json()["detail"]


def test_criar_dispositivo_integrity_sem_serial(client, as_comum, db_session):
    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    res = client.post("/dispositivos", json={"modelo": "X", "estado": "ESTOQUE", "aquisicao": "ALUGADA"})
    assert res.status_code == 400
    assert res.json()["detail"] == "Serial já cadastrado."


def test_criar_dispositivo_exige_modelo_e_estado(client, as_comum):
    sem_modelo = client.post("/dispositivos", json={"numero_serial": "S-MOD", "estado": "ESTOQUE", "aquisicao": "ALUGADA"})
    assert sem_modelo.status_code == 400
    assert "modelo" in sem_modelo.json()["detail"].lower()

    sem_estado = client.post("/dispositivos", json={"numero_serial": "S-EST", "modelo": "X"})
    assert sem_estado.status_code == 400
    assert "estado" in sem_estado.json()["detail"].lower()

    sem_aquisicao = client.post("/dispositivos", json={"numero_serial": "S-AQ", "modelo": "X", "estado": "ESTOQUE"})
    assert sem_aquisicao.status_code == 400
    assert "alugada" in sem_aquisicao.json()["detail"].lower()


def test_criar_dispositivo_comprada(client, as_comum):
    res = client.post(
        "/dispositivos",
        json={"numero_serial": "SN-COMP", "modelo": "X", "estado": "ESTOQUE", "aquisicao": "COMPRADA"},
    )
    assert res.status_code == 201
    assert res.json()["aquisicao"] == "COMPRADA"


def test_criar_dispositivo_aquisicao_invalida(client, as_comum):
    res = client.post(
        "/dispositivos",
        json={"numero_serial": "SN-BAD", "modelo": "X", "estado": "ESTOQUE", "aquisicao": "DOADA"},
    )
    assert res.status_code == 400
    assert "COMPRADA" in res.json()["detail"]


def test_criar_dispositivo_serial_maiusculo(client, as_comum):
    res = client.post(
        "/dispositivos",
        json={"numero_serial": "pb123", "modelo": "P2 BIN", "estado": "ESTOQUE", "aquisicao": "ALUGADA"},
    )
    assert res.status_code == 201
    assert res.json()["numero_serial"] == "PB123"


def test_criar_dispositivo_serial_mesmo_casing(client, as_comum, db_session):
    seed_dispositivo(db_session, serial="PB123")
    res = client.post(
        "/dispositivos",
        json={"numero_serial": "pb123", "modelo": "P2 BIN", "estado": "ESTOQUE", "aquisicao": "ALUGADA"},
    )
    assert res.status_code == 400
    assert "PB123" in res.json()["detail"]


def test_criar_dispositivos_lote_ok(client, as_comum, db_session):
    cli = seed_cliente(db_session, mid="MIDL")
    forn = seed_fornecedor(db_session, nome="FornL")
    res = client.post(
        "/dispositivos/lote",
        json={
            "modelo": "D175",
            "estado": "NO CLIENTE", "aquisicao": "ALUGADA",
            "mid": "MIDL",
            "fornecedor_nome": "FornL",
            "numero_seriais": ["LOT-A", "LOT-B", " LOT-A ", ""],
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["qtd"] == 2
    seriais = {d["numero_serial"] for d in body["dispositivos"]}
    assert seriais == {"LOT-A", "LOT-B"}
    assert all(d["em_evento"] is False for d in body["dispositivos"])
    assert all(d["cliente"] == cli.id for d in body["dispositivos"])
    assert all(d["fornecedor"] == forn.id for d in body["dispositivos"])
    assert all(d["aquisicao"] == "ALUGADA" for d in body["dispositivos"])


def test_criar_dispositivos_lote_serial_maiusculo(client, as_comum):
    res = client.post(
        "/dispositivos/lote",
        json={
            "modelo": "P2 BIN",
            "estado": "ESTOQUE",
            "aquisicao": "ALUGADA",
            "numero_seriais": ["pb123", "PB123", " pb456 "],
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["qtd"] == 2
    assert {d["numero_serial"] for d in body["dispositivos"]} == {"PB123", "PB456"}


def test_criar_dispositivos_lote_vazio(client, as_comum):
    res = client.post("/dispositivos/lote", json={"numero_seriais": ["  ", ""]})
    assert res.status_code == 400
    assert "ao menos um" in res.json()["detail"]


def test_criar_dispositivos_lote_exige_modelo_e_estado(client, as_comum):
    sem_modelo = client.post(
        "/dispositivos/lote",
        json={"numero_seriais": ["LOT-MOD"], "estado": "ESTOQUE", "aquisicao": "ALUGADA"},
    )
    assert sem_modelo.status_code == 400
    assert "modelo" in sem_modelo.json()["detail"].lower()

    sem_estado = client.post(
        "/dispositivos/lote",
        json={"numero_seriais": ["LOT-EST"], "modelo": "X"},
    )
    assert sem_estado.status_code == 400
    assert "estado" in sem_estado.json()["detail"].lower()


def test_criar_dispositivos_lote_serial_existente_nao_grava_nenhum(client, as_comum, db_session):
    seed_dispositivo(db_session, serial="LOT-DUP")
    res = client.post(
        "/dispositivos/lote",
        json={"numero_seriais": ["LOT-NOVO", "LOT-DUP"], "modelo": "X", "estado": "ESTOQUE", "aquisicao": "ALUGADA"},
    )
    assert res.status_code == 400
    assert "LOT-DUP" in res.json()["detail"]
    lista = client.get("/dispositivos?search=LOT-NOVO")
    assert lista.json() == []


def test_criar_dispositivos_lote_estoque_mid_fornecedor(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDE")
    seed_fornecedor(db_session, nome="FornE")
    res = client.post(
        "/dispositivos/lote",
        json={
            "modelo": "D175",
            "estado": "ESTOQUE", "aquisicao": "ALUGADA",
            "mid": "MIDE",
            "fornecedor_nome": "FornE",
            "numero_seriais": ["LOT-E1", "LOT-E2"],
        },
    )
    assert res.status_code == 400
    assert "ESTOQUE" in res.json()["detail"]
    assert client.get("/dispositivos?search=LOT-E1").json() == []


def test_criar_dispositivos_lote_mid_inexistente(client, as_comum):
    res = client.post("/dispositivos/lote", json={"mid": "NAO", "numero_seriais": ["LOT-M1"], "modelo": "X", "estado": "NO CLIENTE", "aquisicao": "ALUGADA"})
    assert res.status_code == 400
    assert "MID" in res.json()["detail"]


def test_criar_dispositivos_lote_com_parceiro(client, as_comum, db_session):
    adq = seed_cliente(db_session, mid="PARL", nome="Stone", parceiro=True)
    res = client.post(
        "/dispositivos/lote",
        json={
            "modelo": "D175",
            "estado": "ESTOQUE", "aquisicao": "ALUGADA",
            "adquirente_nome": "Stone",
            "numero_seriais": ["LOT-P1", "LOT-P2"],
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["qtd"] == 2
    assert all(d["adquirente"] == adq.id for d in body["dispositivos"])


def test_criar_dispositivos_lote_integrity(client, as_comum, db_session):
    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    res = client.post("/dispositivos/lote", json={"numero_seriais": ["LOT-I"], "modelo": "X", "estado": "ESTOQUE", "aquisicao": "ALUGADA"})
    assert res.status_code == 400
    assert "seriais" in res.json()["detail"]


def test_obter_atualizar_deletar_dispositivo(client, as_comum, db_session):
    cli = seed_cliente(db_session, mid="M2")
    forn = seed_fornecedor(db_session, nome="F2")
    disp = seed_dispositivo(db_session, serial="UP1")

    assert client.get(f"/dispositivos/{disp.id}").status_code == 200

    upd = client.put(
        f"/dispositivos/{disp.id}",
        json={
            "modelo": "D200",
            "numero_serial": "UP2",
            "estado": "NO CLIENTE", "aquisicao": "ALUGADA",
            "mid": "M2",
            "fornecedor_nome": "F2",
        },
    )
    assert upd.status_code == 200
    assert upd.json()["numero_serial"] == "UP2"
    assert upd.json()["cliente"] == cli.id
    assert upd.json()["fornecedor"] == forn.id
    assert upd.json()["aquisicao"] == "ALUGADA"

    comprada = client.put(
        f"/dispositivos/{disp.id}",
        json={
            "modelo": "D200",
            "numero_serial": "UP2",
            "estado": "NO CLIENTE",
            "aquisicao": "COMPRADA",
            "mid": "M2",
            "fornecedor_nome": "F2",
        },
    )
    assert comprada.status_code == 200
    assert comprada.json()["aquisicao"] == "COMPRADA"

    limpar = client.put(
        f"/dispositivos/{disp.id}",
        json={"modelo": "D200", "numero_serial": "UP2", "estado": "ESTOQUE", "aquisicao": "ALUGADA"},
    )
    assert limpar.status_code == 200
    assert limpar.json()["cliente"] is None

    assert client.delete(f"/dispositivos/{disp.id}").status_code == 204


def test_dispositivo_404(client, as_comum):
    assert client.get("/dispositivos/99").status_code == 404
    assert client.put("/dispositivos/99", json={"modelo": "X"}).status_code == 404
    assert client.delete("/dispositivos/99").status_code == 404


def test_atualizar_estoque_com_mid_e_fornecedor_400(client, as_comum, db_session):
    disp = seed_dispositivo(db_session)
    res = client.put(
        f"/dispositivos/{disp.id}",
        json={"estado": "ESTOQUE", "aquisicao": "ALUGADA", "mid": "M", "fornecedor_nome": "F", "numero_serial": "X"},
    )
    assert res.status_code == 400
    assert "ESTOQUE" in res.json()["detail"]


def test_atualizar_serial_duplicado(client, as_comum, db_session):
    seed_dispositivo(db_session, serial="AAA")
    outro = seed_dispositivo(db_session, serial="BBB")
    res = client.put(f"/dispositivos/{outro.id}", json={"numero_serial": "AAA", "estado": "REPARO"})
    assert res.status_code == 400


def test_atualizar_mid_inexistente(client, as_comum, db_session):
    disp = seed_dispositivo(db_session)
    res = client.put(f"/dispositivos/{disp.id}", json={"mid": "NOPE", "numero_serial": "ZZ"})
    assert res.status_code == 400


def test_atualizar_fornecedor_inexistente(client, as_comum, db_session):
    disp = seed_dispositivo(db_session)
    res = client.put(f"/dispositivos/{disp.id}", json={"fornecedor_nome": "NOPE", "numero_serial": "ZZ"})
    assert res.status_code == 400


def test_atualizar_dispositivo_parceiro(client, as_comum, db_session):
    adq = seed_cliente(db_session, mid="PARU", nome="Rede", parceiro=True)
    disp = seed_dispositivo(db_session, serial="UPP")
    upd = client.put(
        f"/dispositivos/{disp.id}",
        json={
            "modelo": "D175",
            "numero_serial": "UPP",
            "estado": "ESTOQUE", "aquisicao": "ALUGADA",
            "adquirente_nome": "Rede",
        },
    )
    assert upd.status_code == 200
    assert upd.json()["adquirente"] == adq.id
    assert upd.json()["adquirente_rel"]["nome"] == "Rede"

    limpar = client.put(
        f"/dispositivos/{disp.id}",
        json={"modelo": "D175", "numero_serial": "UPP", "estado": "ESTOQUE", "aquisicao": "ALUGADA"},
    )
    assert limpar.status_code == 200
    assert limpar.json()["adquirente"] is None


def test_formulario_maquina_nao_altera_em_evento(client, as_comum, db_session):
    res = client.post(
        "/dispositivos",
        json={"modelo": "D175", "numero_serial": "EVT-1", "estado": "ESTOQUE", "aquisicao": "ALUGADA", "em_evento": True},
    )
    assert res.status_code == 201
    assert res.json()["em_evento"] is False

    seed_dispositivo(db_session, serial="EVT-2", em_evento=True)
    item = client.get("/dispositivos?search=EVT-2").json()[0]
    off = client.put(
        f"/dispositivos/{item['id']}",
        json={"modelo": "D175", "numero_serial": "EVT-2", "estado": "ESTOQUE", "aquisicao": "ALUGADA", "em_evento": False},
    )
    assert off.status_code == 200
    assert off.json()["em_evento"] is True


def test_atualizar_parceiro_inexistente(client, as_comum, db_session):
    disp = seed_dispositivo(db_session)
    res = client.put(
        f"/dispositivos/{disp.id}",
        json={"adquirente_nome": "NOPE", "numero_serial": "ZZ"},
    )
    assert res.status_code == 400
    assert "Parceiro" in res.json()["detail"]


def test_atualizar_integrity_com_serial(client, as_comum, db_session):
    disp = seed_dispositivo(db_session, serial="INT1")
    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    res = client.put(f"/dispositivos/{disp.id}", json={"numero_serial": "INT2", "modelo": "X"})
    assert res.status_code == 400
    assert "INT2" in res.json()["detail"]


def test_atualizar_integrity_sem_serial(client, as_comum, db_session):
    disp = seed_dispositivo(db_session, serial="INT3")
    db_session.commit = lambda: (_ for _ in ()).throw(IntegrityError("x", {}, Exception("d")))
    res = client.put(f"/dispositivos/{disp.id}", json={"modelo": "X"})
    assert res.status_code == 400
    assert res.json()["detail"] == "Serial já cadastrado."


def test_criar_estoque_com_mid_e_fornecedor_400(client, as_comum, db_session):
    seed_cliente(db_session, mid="M")
    seed_fornecedor(db_session, nome="F")
    res = client.post(
        "/dispositivos",
        json={"modelo": "X", "estado": "ESTOQUE", "aquisicao": "ALUGADA", "mid": "M", "fornecedor_nome": "F", "numero_serial": "X1"},
    )
    assert res.status_code == 400
    assert "ESTOQUE" in res.json()["detail"]


def test_check_aquisicao_invalida(db_session):
    db_session.add(models.Dispositivo(modelo="X", numero_serial="AQ1", estado="ESTOQUE", aquisicao="DOADA"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_check_estado_invalido(db_session):
    db_session.add(models.Dispositivo(modelo="X", numero_serial="E1", estado="CAMPO"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_check_estoque_com_cliente_e_fornecedor(db_session):
    cli = seed_cliente(db_session, mid="MX")
    forn = seed_fornecedor(db_session, nome="FX", codigo="FX1")
    db_session.add(
        models.Dispositivo(
            modelo="X",
            numero_serial="E2",
            estado="ESTOQUE",
            cliente=cli.id,
            fornecedor=forn.id,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_check_serial_vazio(db_session):
    db_session.add(models.Dispositivo(modelo="X", numero_serial="", estado="ESTOQUE"))
    with pytest.raises(IntegrityError):
        db_session.commit()
