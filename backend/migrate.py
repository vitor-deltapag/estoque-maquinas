"""Obsoleto. Não execute.

Schema: alembic upgrade head
(Este script só tentava ADD COLUMN perfil/email.)
"""
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL não encontrada.")
    exit(1)

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE dados_usuario ADD COLUMN perfil VARCHAR(50) DEFAULT 'COMUM';"))
        conn.commit()
        print("Coluna 'perfil' adicionada com sucesso.")
    except Exception as e:
        print("Erro ao adicionar 'perfil' (pode já existir):", e)
    
    try:
        conn.execute(text("ALTER TABLE dados_usuario ADD COLUMN email VARCHAR(255);"))
        conn.commit()
        print("Coluna 'email' adicionada com sucesso.")
    except Exception as e:
        print("Erro ao adicionar 'email' (pode já existir):", e)

print("Migração concluída.")
