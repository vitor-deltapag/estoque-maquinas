# importar_excel.py
import csv
import os
from datetime import datetime
from io import StringIO

from sqlalchemy import text

from database import SessionLocal
import models

ESTADOS = {"NO CLIENTE", "ESTOQUE", "REPARO", "MAQUINA PERDIDA"}
AQUISICOES = {"COMPRADA", "ALUGADA"}


def _texto(linha, coluna):
    return (linha.get(coluna) or "").strip()


def _estado(valor):
    limpo = valor.strip().upper()
    if limpo in ESTADOS:
        return limpo
    return None


def _texto_csv(caminho):
    bruto = open(caminho, "rb").read()
    for codificacao in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return bruto.decode(codificacao)
        except UnicodeDecodeError:
            continue
    return bruto.decode("latin-1")


def importar():
    db = SessionLocal()
    caminho_csv = "dados.csv"

    if not os.path.exists(caminho_csv):
        print(f"Erro: O arquivo {caminho_csv} não foi encontrado na pasta!", flush=True)
        return

    print("Iniciando importação dos dados...", flush=True)

    fornecedores_novos = set()
    fornecedores_atualizados = set()
    clientes_novos = set()
    clientes_atualizados = set()
    maquinas_novas = 0
    maquinas_atualizadas = 0

    try:
        db.execute(text("ALTER TABLE dispositivos DROP CONSTRAINT IF EXISTS ck_dispositivos_estoque"))

        fornecedores_por_nome = {item.nome: item for item in db.query(models.Fornecedor).all()}
        clientes_por_mid = {}
        clientes_por_nome = {}
        for cliente in db.query(models.Cliente).all():
            if cliente.mid:
                clientes_por_mid[cliente.mid] = cliente
            if cliente.nome and cliente.nome not in clientes_por_nome:
                clientes_por_nome[cliente.nome] = cliente
        maquinas_por_serial = {}
        for dispositivo in db.query(models.Dispositivo).all():
            if dispositivo.numero_serial:
                maquinas_por_serial[dispositivo.numero_serial.upper()] = dispositivo

        texto = _texto_csv(caminho_csv)
        conteudo = texto[:2048]
        delimitador = ";" if ";" in conteudo else ","
        leitor = csv.DictReader(StringIO(texto), delimiter=delimitador)
        if not leitor.fieldnames:
            raise RuntimeError("O CSV não tem cabeçalho.")
        leitor.fieldnames = [(nome or "").strip().lower() for nome in leitor.fieldnames]

        linhas = list(leitor)
        for linha in linhas:
            nome_fornecedor = _texto(linha, "fornecedor")
            codigo_informado = "codigo" in linha
            codigo_fornecedor = _texto(linha, "codigo") or None
            if nome_fornecedor:
                forn = fornecedores_por_nome.get(nome_fornecedor)
                if forn is None:
                    forn = models.Fornecedor(
                        nome=nome_fornecedor,
                        codigo=codigo_fornecedor if codigo_informado else None,
                    )
                    db.add(forn)
                    fornecedores_por_nome[nome_fornecedor] = forn
                    fornecedores_novos.add(id(forn))
                elif codigo_informado and forn.codigo != codigo_fornecedor:
                    forn.codigo = codigo_fornecedor
                    if id(forn) not in fornecedores_novos:
                        fornecedores_atualizados.add(id(forn))

            nome_cliente = _texto(linha, "nome")
            fantasia_informada = "nome_fantasia" in linha
            nome_fantasia = _texto(linha, "nome_fantasia") or None
            mid_cliente = _texto(linha, "mid") or None
            if nome_cliente or mid_cliente:
                cli = clientes_por_mid.get(mid_cliente) if mid_cliente else clientes_por_nome.get(nome_cliente)
                if cli is None:
                    cli = models.Cliente(
                        nome=nome_cliente or mid_cliente,
                        nome_fantasia=nome_fantasia,
                        mid=mid_cliente,
                    )
                    db.add(cli)
                    clientes_novos.add(id(cli))
                    if cli.mid:
                        clientes_por_mid[cli.mid] = cli
                    if cli.nome and cli.nome not in clientes_por_nome:
                        clientes_por_nome[cli.nome] = cli
                mudou_cliente = False
                if nome_cliente and cli.nome != nome_cliente:
                    cli.nome = nome_cliente
                    mudou_cliente = True
                    if nome_cliente not in clientes_por_nome:
                        clientes_por_nome[nome_cliente] = cli
                if fantasia_informada and cli.nome_fantasia != nome_fantasia:
                    cli.nome_fantasia = nome_fantasia
                    mudou_cliente = True
                if mid_cliente and cli.mid != mid_cliente:
                    cli.mid = mid_cliente
                    clientes_por_mid[mid_cliente] = cli
                    mudou_cliente = True
                if mudou_cliente and id(cli) not in clientes_novos:
                    clientes_atualizados.add(id(cli))

        db.flush()

        linhas_processadas = 0
        for linha in linhas:
            nome_fornecedor = _texto(linha, "fornecedor")
            forn = fornecedores_por_nome.get(nome_fornecedor) if nome_fornecedor else None
            id_fornecedor = forn.id if forn is not None else None

            nome_cliente = _texto(linha, "nome")
            mid_cliente = _texto(linha, "mid") or None
            id_cliente = None
            if nome_cliente or mid_cliente:
                cli = clientes_por_mid.get(mid_cliente) if mid_cliente else clientes_por_nome.get(nome_cliente)
                id_cliente = cli.id if cli is not None else None

            serial = _texto(linha, "numero_serial").upper()
            modelo_informado = "modelo" in linha
            modelo = _texto(linha, "modelo") or None
            bruto_estado = _texto(linha, "estado")
            estado = _estado(bruto_estado)
            aquisicao = _texto(linha, "aquisicao").upper()
            if aquisicao not in AQUISICOES:
                aquisicao = None

            if serial:
                disp = maquinas_por_serial.get(serial)
                if disp is None:
                    disp = models.Dispositivo(
                        numero_serial=serial,
                        modelo=modelo,
                        estado=estado or "ESTOQUE",
                        aquisicao=aquisicao,
                        fornecedor=id_fornecedor,
                        cliente=id_cliente,
                        data_chegada=datetime.now(),
                        data_ultima_atualizacao=datetime.now(),
                    )
                    db.add(disp)
                    maquinas_por_serial[serial] = disp
                    maquinas_novas += 1
                else:
                    if bruto_estado and estado is None:
                        print(
                            f"Aviso: estado '{bruto_estado}' do serial {serial} fora da lista. O estado atual foi mantido.",
                            flush=True,
                        )
                    disp.numero_serial = serial
                    if modelo_informado:
                        disp.modelo = modelo
                    if estado:
                        disp.estado = estado
                    if aquisicao:
                        disp.aquisicao = aquisicao
                    if "fornecedor" in linha:
                        disp.fornecedor = id_fornecedor
                    if "nome" in linha or "mid" in linha:
                        disp.cliente = id_cliente
                    disp.data_ultima_atualizacao = datetime.now()
                    maquinas_atualizadas += 1

            linhas_processadas += 1
            if linhas_processadas % 500 == 0:
                print(f"{linhas_processadas} linhas analisadas...", flush=True)

        db.flush()
        db.execute(text("""
            ALTER TABLE dispositivos
            ADD CONSTRAINT ck_dispositivos_estoque
            CHECK (
                estado IS NULL
                OR estado <> 'ESTOQUE'
                OR cliente IS NULL
                OR fornecedor IS NULL
            ) NOT VALID
        """))
        db.commit()
        print(
            "Sucesso! Importação concluída. "
            f"{linhas_processadas} linhas. "
            f"Fornecedores: {len(fornecedores_novos)} novos, {len(fornecedores_atualizados)} atualizados. "
            f"Clientes: {len(clientes_novos)} novos, {len(clientes_atualizados)} atualizados. "
            f"Máquinas: {maquinas_novas} novas, {maquinas_atualizadas} atualizadas.",
            flush=True,
        )

    except Exception as e:
        db.rollback()
        print(f"Erro durante a importação: {e}", flush=True)
    finally:
        db.close()


if __name__ == "__main__":
    importar()
