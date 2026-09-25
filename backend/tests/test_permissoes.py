import models
from tests.conftest import seed_cliente, seed_dispositivo


def test_comercial_nao_altera_estoque_e_desvincula(client, db_session):
    comercial = models.DadosUsuario(nome="Com", email="comercial@teste.local", perfil="COMERCIAL", status="ATIVO")
    comercial.id = 7
    db_session.add(comercial)
    db_session.commit()
    from main import app
    from deps import get_current_user

    app.dependency_overrides[get_current_user] = lambda: comercial
    cli = seed_cliente(db_session, mid="MIDC")
    disp = seed_dispositivo(db_session, serial="PB12345678901", cliente=cli, estado="NO CLIENTE")

    bloqueado = client.post("/dispositivos", json={"numero_serial": "PB12345678902", "modelo": "P2 BIN", "estado": "ESTOQUE", "aquisicao": "ALUGADA"})
    assert bloqueado.status_code == 403

    resumo = client.get("/movimentacoes/resumo")
    assert resumo.status_code == 403

    ok = client.post(f"/dispositivos/{disp.id}/desvincular")
    assert ok.status_code == 200
    assert ok.json()["cliente"] is None
    assert ok.json()["estado"] == "ESTOQUE"
    app.dependency_overrides.pop(get_current_user, None)


def test_operacional_nao_baixa_mas_ve_movimentacao(client, db_session):
    user = models.DadosUsuario(nome="Op", email="op@teste.local", perfil="OPERACIONAL", status="ATIVO")
    user.id = 8
    from main import app
    from deps import get_current_user

    app.dependency_overrides[get_current_user] = lambda: user
    resumo = client.get("/movimentacoes/resumo")
    assert resumo.status_code == 200
    me = client.get("/usuarios/me")
    assert me.status_code == 200
    assert me.json()["permissoes"]["baixar_movimentacoes"] is False
    assert me.json()["permissoes"]["alterar_estoque"] is True
    usuarios = client.get("/usuarios")
    assert usuarios.status_code == 403
    app.dependency_overrides.pop(get_current_user, None)
