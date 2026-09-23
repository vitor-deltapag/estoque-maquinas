from datetime import datetime, timedelta

import models
from conftest import seed_cliente


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
    bloco = client.get("/movimentacoes/resumo").json()["clientes"][0]["blocos"][0]
    assert bloco["trocas"] == 1
    assert bloco["vinculos_novos"] == 0
    assert bloco["desvinculos"] == 0
