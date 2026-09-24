from datetime import date, datetime, timedelta

import models
from conftest import seed_cliente, seed_dispositivo


def _voltar_vinculo(db, serial):
    linha = db.query(models.MovimentacaoMaquina).filter_by(numero_serial=serial, tipo="VINCULO_CLIENTE").one()
    linha.created_at = datetime.now() - timedelta(days=8)
    db.commit()


def _maquina(serial, mid="MIDM"):
    return {
        "numero_serial": serial,
        "modelo": "P2 BIN",
        "estado": "NO CLIENTE",
        "aquisicao": "ALUGADA",
        "mid": mid,
    }


def test_exclusao_permanece_no_log_com_serial_e_usuario(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDM", nome="Loja")
    criado = client.post("/dispositivos", json=_maquina("PBDEL"))
    assert criado.status_code == 201
    assert client.delete(f"/dispositivos/{criado.json()['id']}").status_code == 204
    resumo = client.get("/movimentacoes/resumo").json()
    exclusao = next(item for item in resumo["logs"] if item["tipo"] == "EXCLUSAO")
    assert exclusao["numero_serial"] == "PBDEL"
    assert exclusao["usuario_nome"] == "Teste"
    ficha = client.get("/movimentacoes/maquina?serial=PBDEL")
    assert ficha.status_code == 200
    assert ficha.json()["excluida"] is True
    assert any(item["tipo"] == "EXCLUSAO" for item in ficha.json()["logs"])


def test_mesma_maquina_na_semana_nao_altera_saldo(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDM", nome="Loja")
    criado = client.post("/dispositivos", json=_maquina("PB100"))
    assert criado.status_code == 201
    saida = client.put(f"/dispositivos/{criado.json()['id']}", json={
        "numero_serial": "PB100",
        "modelo": "P2 BIN",
        "estado": "ESTOQUE",
        "aquisicao": "ALUGADA",
    })
    assert saida.status_code == 200
    resumo = client.get("/movimentacoes/resumo").json()
    bloco = resumo["clientes"][0]["blocos"][0]
    assert bloco["trocas"] == 0
    assert bloco["vinculos_novos"] == 0
    assert bloco["desvinculos"] == 0
    assert bloco["detalhe"][0]["situacao"] == "nao_alterou"
    assert resumo["totais"] == {"vinculos_novos": 0, "desvinculos": 0, "trocas": 0}


def test_saida_e_entrada_de_maquinas_diferentes_e_uma_troca(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDM", nome="Loja")
    antiga = client.post("/dispositivos", json=_maquina("PB100"))
    assert antiga.status_code == 201
    _voltar_vinculo(db_session, "PB100")
    nova = client.post("/dispositivos", json=_maquina("PB200"))
    assert nova.status_code == 201
    saida = client.put(f"/dispositivos/{antiga.json()['id']}", json={
        "numero_serial": "PB100",
        "modelo": "P2 BIN",
        "estado": "ESTOQUE",
        "aquisicao": "ALUGADA",
    })
    assert saida.status_code == 200
    resumo = client.get("/movimentacoes/resumo").json()
    bloco = resumo["clientes"][0]["blocos"][0]
    assert bloco["trocas"] == 1
    assert bloco["vinculos_novos"] == 0
    assert bloco["desvinculos"] == 0
    assert resumo["totais"] == {"vinculos_novos": 0, "desvinculos": 0, "trocas": 1}


def _no_cliente(serial, mid):
    return {
        "numero_serial": serial,
        "modelo": "P2 BIN",
        "estado": "NO CLIENTE",
        "aquisicao": "ALUGADA",
        "mid": mid,
    }


def test_maquina_que_muda_de_cliente_conta_nos_dois_lados(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDA", nome="Loja A")
    seed_cliente(db_session, mid="MIDB", nome="Loja B")
    criado = client.post("/dispositivos", json=_maquina("PB100", "MIDA"))
    assert criado.status_code == 201
    _voltar_vinculo(db_session, "PB100")
    mudou = client.put(f"/dispositivos/{criado.json()['id']}", json=_no_cliente("PB100", "MIDB"))
    assert mudou.status_code == 200
    totais = client.get("/movimentacoes/resumo").json()["totais"]
    assert totais == {"vinculos_novos": 1, "desvinculos": 1, "trocas": 0}


def test_busca_serial_mostra_os_tres_ultimos_vinculos(client, as_comum, db_session):
    for mid, nome in (("MIDA", "Loja A"), ("MIDB", "Loja B"), ("MIDC", "Loja C"), ("MIDD", "Loja D")):
        seed_cliente(db_session, mid=mid, nome=nome)
    criado = client.post("/dispositivos", json=_maquina("PB100", "MIDA"))
    assert criado.status_code == 201
    item_id = criado.json()["id"]
    for mid in ("MIDB", "MIDC", "MIDD"):
        mudou = client.put(f"/dispositivos/{item_id}", json=_no_cliente("PB100", mid))
        assert mudou.status_code == 200

    ficha = client.get("/movimentacoes/maquina?serial=pb100")
    assert ficha.status_code == 200
    corpo = ficha.json()
    assert corpo["numero_serial"] == "PB100"
    assert corpo["modelo"] == "P2 BIN"
    assert corpo["estado"] == "NO CLIENTE"
    assert corpo["cliente_atual"] == {"nome": "Loja D", "mid": "MIDD"}
    assert [item["mid"] for item in corpo["ultimos_vinculos"]] == ["MIDD", "MIDC", "MIDB"]
    assert [item["cliente_nome"] for item in corpo["ultimos_vinculos"]] == ["Loja D", "Loja C", "Loja B"]


def test_entrada_de_evento_nao_entra_no_total(client, as_comum, db_session):
    seed_cliente(db_session, mid="MIDEVT", nome="Cliente Evento")
    seed_dispositivo(db_session, serial="EVT-A")
    hoje = date.today().isoformat()
    criado = client.post("/eventos", json={
        "nome": "Feira",
        "mid": "MIDEVT",
        "data_inicio": hoje,
        "data_fim": hoje,
        "numero_seriais": ["EVT-A"],
    })
    assert criado.status_code == 201
    resumo = client.get("/movimentacoes/resumo").json()
    assert resumo["totais"] == {"vinculos_novos": 0, "desvinculos": 0, "trocas": 0}
    assert resumo["clientes"][0]["blocos"][0]["bloco"] == "evento"
    assert resumo["clientes"][0]["blocos"][0]["vinculos_novos"] == 1


def test_busca_serial_sem_historico_e_erros(client, as_comum, db_session):
    criado = client.post("/dispositivos", json={
        "numero_serial": "PB300",
        "modelo": "P2 BIN",
        "estado": "ESTOQUE",
        "aquisicao": "COMPRADA",
    })
    assert criado.status_code == 201
    ficha = client.get("/movimentacoes/maquina?serial=PB300").json()
    assert ficha["estado"] == "ESTOQUE"
    assert ficha["cliente_atual"] is None
    assert ficha["ultimos_vinculos"] == []
    assert client.get("/movimentacoes/maquina?serial=%20").status_code == 400
    assert client.get("/movimentacoes/maquina").status_code == 400
    assert client.get("/movimentacoes/maquina?serial=NAOEXISTE").status_code == 404
