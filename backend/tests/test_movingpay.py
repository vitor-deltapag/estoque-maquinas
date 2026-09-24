import httpx
import pytest

import models
import movingpay
from movingpay import (
    MovingpayClient,
    MovingpayErro,
    _extrair_token,
    cliente_padrao,
    fantasia_do_estabelecimento,
    mid_do_estabelecimento,
    nome_do_estabelecimento,
    sincronizar_clientes,
    status_do_estabelecimento,
)


@pytest.fixture(autouse=True)
def _isolar(monkeypatch):
    for chave in ("MOVINGPAY_EMAIL", "MOVINGPAY_PASSWORD", "MOVINGPAY_CUSTOMER_ID"):
        monkeypatch.delenv(chave, raising=False)
    monkeypatch.setattr(movingpay, "_ultima_sync", None)
    monkeypatch.setattr(movingpay, "_cliente_padrao", None)


def _transport(paginas, chamadas=None, token_corpo=None):
    def responder(request: httpx.Request) -> httpx.Response:
        if chamadas is not None:
            chamadas.append(request)
        if request.url.path.endswith("/acessar"):
            return httpx.Response(200, json=token_corpo or {"token": "abc"})
        pagina = int(request.url.params.get("page", "1"))
        dados = paginas[pagina - 1] if pagina <= len(paginas) else []
        return httpx.Response(200, json={"page": pagina, "lastPage": len(paginas), "data": dados})

    return httpx.MockTransport(responder)


def _cliente(paginas, **kwargs):
    return MovingpayClient(transport=_transport(paginas, **kwargs))


def test_sincronizar_cria_depois_atualiza_sem_mexer_em_parceiro(db_session):
    dados = [{"codigoCliente": 295365, "razaoSocial": "Loja Um", "nomeFantasia": "Um", "situacao": 1}]
    primeiro = sincronizar_clientes(db_session, _cliente([dados]), forcar=True)
    assert primeiro["criados"] == 1
    assert primeiro["ignorado"] is None

    cliente = db_session.query(models.Cliente).filter_by(mid="295365").one()
    assert cliente.nome == "Loja Um"
    assert cliente.status == "ATIVO"
    cliente.parceiro = True
    db_session.commit()

    dados[0]["razaoSocial"] = "Loja Um Ltda"
    segundo = sincronizar_clientes(db_session, _cliente([dados]), forcar=True)
    assert segundo["atualizados"] == 1
    db_session.refresh(cliente)
    assert cliente.nome == "Loja Um Ltda"
    assert cliente.parceiro is True


def test_percorre_paginas_ignora_sem_mid_e_manda_headers(db_session, monkeypatch):
    monkeypatch.setenv("MOVINGPAY_CUSTOMER_ID", "149")
    chamadas = []
    paginas = [
        [{"codigoCliente": "1", "razaoSocial": "A"}, {"razaoSocial": "Sem MID"}],
        [{"codigoCliente": "2", "razaoSocial": "B"}],
    ]
    resumo = sincronizar_clientes(db_session, _cliente(paginas, chamadas=chamadas), forcar=True)
    assert resumo["criados"] == 2
    assert resumo["ignorados"] == 1

    logins = [c for c in chamadas if c.url.path.endswith("/acessar")]
    listas = [c for c in chamadas if c.url.path.endswith("/estabelecimentos")]
    assert len(logins) == 1
    assert len(listas) == 2
    assert listas[0].headers["Authorization"] == "Bearer abc"
    assert listas[0].headers["Customer"] == "149"


def test_janela_de_dez_minutos(db_session):
    dados = [{"codigoCliente": "10", "razaoSocial": "X"}]
    assert sincronizar_clientes(db_session, _cliente([dados]))["criados"] == 1
    de_novo = sincronizar_clientes(db_session, _cliente([dados]))
    assert de_novo["ignorado"] == "sincronizado há pouco"
    assert sincronizar_clientes(db_session, _cliente([dados]), forcar=True)["atualizados"] == 1


def test_sincronizacao_em_andamento(db_session):
    movingpay._lock_sync.acquire()
    try:
        resumo = sincronizar_clientes(db_session, _cliente([[]]), forcar=True)
    finally:
        movingpay._lock_sync.release()
    assert resumo["ignorado"] == "em andamento"


def test_sem_configuracao_levanta_erro(db_session):
    with pytest.raises(MovingpayErro):
        sincronizar_clientes(db_session)


def test_falha_ao_gravar_vai_para_falhas(db_session, monkeypatch):
    def quebrar(*args, **kwargs):
        raise RuntimeError("banco")

    monkeypatch.setattr(movingpay, "_upsert", quebrar)
    resumo = sincronizar_clientes(db_session, _cliente([[{"codigoCliente": "7"}]]), forcar=True)
    assert resumo["falhas"] == ["7"]
    assert resumo["criados"] == 0


def test_token_renovado_apos_401(db_session):
    estado = {"login": 0, "lista": 0}

    def responder(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/acessar"):
            estado["login"] += 1
            return httpx.Response(200, json={"token": f"t{estado['login']}"})
        estado["lista"] += 1
        if estado["lista"] == 1:
            return httpx.Response(401)
        return httpx.Response(200, json={"page": 1, "lastPage": 1, "data": [{"codigoCliente": "5"}]})

    cliente = MovingpayClient(transport=httpx.MockTransport(responder))
    resumo = sincronizar_clientes(db_session, cliente, forcar=True)
    assert resumo["criados"] == 1
    assert estado["login"] == 2


def test_resposta_sem_lista_encerra(db_session):
    def responder(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/acessar"):
            return httpx.Response(200, json={"token": "abc"})
        return httpx.Response(200, json={"mensagem": "vazio"})

    cliente = MovingpayClient(transport=httpx.MockTransport(responder))
    assert sincronizar_clientes(db_session, cliente, forcar=True)["criados"] == 0


def test_mapeamento_de_campos():
    assert mid_do_estabelecimento({"codigoCliente": 1, "mid": "2"}) == "1"
    assert mid_do_estabelecimento({"mid": " 2 "}) == "2"
    assert mid_do_estabelecimento({"codigoEC": 3}) == "3"
    assert mid_do_estabelecimento({"codigoCliente": " "}) is None

    assert nome_do_estabelecimento({"social_reason": "Social"}, "9") == "Social"
    assert nome_do_estabelecimento({"nomeFantasia": "Fant"}, "9") == "Fant"
    assert nome_do_estabelecimento({}, "9") == "Cliente 9"
    assert fantasia_do_estabelecimento({"nomeFantasia": "  "}) is None

    assert status_do_estabelecimento({"situacao": 4}) == "DESCREDENCIADO"
    assert status_do_estabelecimento({"situacao": "0"}) == "BLOQUEADO"
    assert status_do_estabelecimento({"situacao": 9}) == "9"
    assert status_do_estabelecimento({"situacao": "x"}) == "x"
    assert status_do_estabelecimento({}) is None


def test_extrair_token():
    assert _extrair_token(" abc ") == "abc"
    assert _extrair_token({"access_token": "a1"}) == "a1"
    assert _extrair_token({"data": {"token": "d1"}}) == "d1"
    with pytest.raises(MovingpayErro):
        _extrair_token({"mensagem": "sem token"})


def test_cliente_padrao_reaproveita_a_instancia():
    primeiro = cliente_padrao()
    try:
        assert cliente_padrao() is primeiro
    finally:
        primeiro.close()


def test_rota_sem_configuracao_400(client, as_comum):
    res = client.post("/clientes/sincronizar")
    assert res.status_code == 400
    assert "MOVINGPAY_EMAIL" in res.json()["detail"]


def test_rota_movingpay_fora_502(client, as_comum, monkeypatch):
    def quebrar(db, forcar=False):
        raise httpx.ConnectError("fora")

    monkeypatch.setattr("routers.clientes.sincronizar_clientes", quebrar)
    res = client.post("/clientes/sincronizar")
    assert res.status_code == 502


def test_rota_repassa_forcar(client, as_comum, monkeypatch):
    recebido = {}

    def falso(db, forcar=False):
        recebido["forcar"] = forcar
        return {"criados": 1, "atualizados": 0, "ignorados": 0, "falhas": [], "ignorado": None}

    monkeypatch.setattr("routers.clientes.sincronizar_clientes", falso)
    res = client.post("/clientes/sincronizar?forcar=true")
    assert res.status_code == 200
    assert res.json()["criados"] == 1
    assert recebido["forcar"] is True
