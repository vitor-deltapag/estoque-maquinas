# importar_excel.py
import csv
import os
from datetime import datetime
from database import SessionLocal  # Garanta que o nome do seu arquivo de sessão é este
import models

def importar():
    db = SessionLocal()
    caminho_csv = "dados.csv"

    if not os.path.exists(caminho_csv):
        print(f"Erro: O arquivo {caminho_csv} não foi encontrado na pasta!")
        return

    print("Iniciando importação dos dados...")
    
    # Dicionários de cache para evitar cadastrar o mesmo Cliente/Fornecedor várias vezes
    fornecedores_cache = {}
    clientes_cache = {}

    try:
        with open(caminho_csv, mode="r", encoding="windows-1252") as arquivo:
            # Identifica se o CSV usa vírgula ou ponto e vírgula automaticamente
            conteudo = arquivo.read(2048)
            delimitador = ";" if ";" in conteudo else ","
            arquivo.seek(0)
            
            leitor = csv.DictReader(arquivo, delimiter=delimitador)

            linhas_processadas = 0
            for linha in leitor:
                # 1. PROCESSAR FORNECEDOR
                nome_fornecedor = linha.get('fornecedor', '').strip()
                codigo_fornecedor = linha.get('codigo', '').strip()
                
                id_fornecedor = None
                if nome_fornecedor:
                    # Se não estiver no cache, busca no banco ou cria
                    if nome_fornecedor not in fornecedores_cache:
                        forn = db.query(models.Fornecedor).filter(models.Fornecedor.nome == nome_fornecedor).first()
                        if not forn:
                            forn = models.Fornecedor(nome=nome_fornecedor, codigo=codigo_fornecedor if codigo_fornecedor else None)
                            db.add(forn)
                            db.commit()
                            db.refresh(forn)
                        fornecedores_cache[nome_fornecedor] = forn.id
                    id_fornecedor = fornecedores_cache[nome_fornecedor]

                # 2. PROCESSAR CLIENTE (Baseado no MID ou Nome)
                nome_cliente = linha.get('nome', '').strip()
                nome_fantasia = linha.get('nome_fantasia', '').strip()
                mid_cliente = linha.get('mid', '').strip()
                
                id_cliente = None
                if nome_cliente or mid_cliente:
                    chave_cliente = mid_cliente if mid_cliente else nome_cliente
                    if chave_cliente not in clientes_cache:
                        # Busca por MID ou por Nome
                        cli = None
                        if mid_cliente:
                            cli = db.query(models.Cliente).filter(models.Cliente.mid == mid_cliente).first()
                        else:
                            cli = db.query(models.Cliente).filter(models.Cliente.nome == nome_cliente).first()
                        
                        if not cli:
                            cli = models.Cliente(
                                nome=nome_cliente, 
                                nome_fantasia=nome_fantasia if nome_fantasia else None,
                                mid=mid_cliente if mid_cliente else None
                            )
                            db.add(cli)
                            db.commit()
                            db.refresh(cli)
                        clientes_cache[chave_cliente] = cli.id
                    id_cliente = clientes_cache[chave_cliente]

                # 3. CADASTRAR DISPOSITIVO
                serial = linha.get('numero_serial', '').strip().upper()
                modelo = linha.get('modelo', '').strip()
                estado = linha.get('estado', '').strip()

                if serial:
                    # Verifica se a máquina já está cadastrada para não duplicar
                    disp_existente = db.query(models.Dispositivo).filter(models.Dispositivo.numero_serial == serial).first()
                    if not disp_existente:
                        novo_disp = models.Dispositivo(
                            numero_serial=serial,
                            modelo=modelo if modelo else None,
                            estado=estado if estado else "ESTOQUE",
                            fornecedor=id_fornecedor,
                            cliente=id_cliente,
                            data_chegada=datetime.now(),
                            data_ultima_atualizacao=datetime.now()
                        )
                        db.add(novo_disp)
                
                linhas_processadas += 1
                if linhas_processadas % 50 == 0:
                    print(f"{linhas_processadas} linhas analisadas...")

            db.commit()
            print(f"Sucesso! Importação concluída. {linhas_processadas} registros processados.")

    except Exception as e:
        db.rollback()
        print(f"Erro durante a importação: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    importar()