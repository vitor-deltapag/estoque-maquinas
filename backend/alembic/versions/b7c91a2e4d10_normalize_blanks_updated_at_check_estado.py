"""normalize blanks, updated_at, check estado

Revision ID: b7c91a2e4d10
Revises: dc5e5bbe4009
Create Date: 2026-09-15 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "b7c91a2e4d10"
down_revision: Union[str, Sequence[str], None] = "dc5e5bbe4009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE dispositivos SET numero_serial = NULL WHERE btrim(numero_serial) = '';")
    op.execute("UPDATE cliente SET mid = NULL WHERE btrim(mid) = '';")
    op.execute("UPDATE fornecedor SET codigo = NULL WHERE btrim(codigo) = '';")
    op.execute("UPDATE dados_usuario SET email = NULL WHERE btrim(email) = '';")
    op.execute("UPDATE dispositivos SET estado = NULL WHERE btrim(estado) = '';")

    op.execute("""
        CREATE OR REPLACE FUNCTION estoque_dispositivos_before_write()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            IF NEW.numero_serial IS NOT NULL AND btrim(NEW.numero_serial) = '' THEN
                NEW.numero_serial := NULL;
            END IF;
            IF NEW.estado IS NOT NULL AND btrim(NEW.estado) = '' THEN
                NEW.estado := NULL;
            END IF;
            IF TG_OP = 'UPDATE' THEN
                NEW.data_ultima_atualizacao := now();
            ELSIF NEW.data_ultima_atualizacao IS NULL THEN
                NEW.data_ultima_atualizacao := now();
            END IF;
            RETURN NEW;
        END;
        $$;
    """)
    op.execute("""
        DROP TRIGGER IF EXISTS trg_dispositivos_before_write ON dispositivos;
        CREATE TRIGGER trg_dispositivos_before_write
        BEFORE INSERT OR UPDATE ON dispositivos
        FOR EACH ROW
        EXECUTE FUNCTION estoque_dispositivos_before_write();
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION estoque_cliente_before_write()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            IF NEW.mid IS NOT NULL AND btrim(NEW.mid) = '' THEN
                NEW.mid := NULL;
            END IF;
            RETURN NEW;
        END;
        $$;
    """)
    op.execute("""
        DROP TRIGGER IF EXISTS trg_cliente_before_write ON cliente;
        CREATE TRIGGER trg_cliente_before_write
        BEFORE INSERT OR UPDATE ON cliente
        FOR EACH ROW
        EXECUTE FUNCTION estoque_cliente_before_write();
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION estoque_fornecedor_before_write()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            IF NEW.codigo IS NOT NULL AND btrim(NEW.codigo) = '' THEN
                NEW.codigo := NULL;
            END IF;
            RETURN NEW;
        END;
        $$;
    """)
    op.execute("""
        DROP TRIGGER IF EXISTS trg_fornecedor_before_write ON fornecedor;
        CREATE TRIGGER trg_fornecedor_before_write
        BEFORE INSERT OR UPDATE ON fornecedor
        FOR EACH ROW
        EXECUTE FUNCTION estoque_fornecedor_before_write();
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION estoque_usuario_before_write()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            IF NEW.email IS NOT NULL AND btrim(NEW.email) = '' THEN
                NEW.email := NULL;
            END IF;
            RETURN NEW;
        END;
        $$;
    """)
    op.execute("""
        DROP TRIGGER IF EXISTS trg_dados_usuario_before_write ON dados_usuario;
        CREATE TRIGGER trg_dados_usuario_before_write
        BEFORE INSERT OR UPDATE ON dados_usuario
        FOR EACH ROW
        EXECUTE FUNCTION estoque_usuario_before_write();
    """)

    op.create_check_constraint(
        "ck_dispositivos_serial_nao_vazio",
        "dispositivos",
        "numero_serial IS NULL OR numero_serial <> ''",
    )
    op.create_check_constraint(
        "ck_cliente_mid_nao_vazio",
        "cliente",
        "mid IS NULL OR mid <> ''",
    )
    op.create_check_constraint(
        "ck_fornecedor_codigo_nao_vazio",
        "fornecedor",
        "codigo IS NULL OR codigo <> ''",
    )
    op.create_check_constraint(
        "ck_usuario_email_nao_vazio",
        "dados_usuario",
        "email IS NULL OR email <> ''",
    )
    op.create_check_constraint(
        "ck_dispositivos_estado",
        "dispositivos",
        "estado IS NULL OR estado IN ('NO CLIENTE', 'ESTOQUE', 'REPARO', 'MAQUINA PERDIDA')",
    )
    # NOT VALID: ~370 linhas antigas estão ESTOQUE com cliente e fornecedor.
    # Novos writes passam a ser recusados; validar depois de limpar o legado.
    op.execute("""
        ALTER TABLE dispositivos
        ADD CONSTRAINT ck_dispositivos_estoque
        CHECK (
            estado IS NULL
            OR estado <> 'ESTOQUE'
            OR cliente IS NULL
            OR fornecedor IS NULL
        ) NOT VALID;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE dispositivos DROP CONSTRAINT IF EXISTS ck_dispositivos_estoque;")
    op.drop_constraint("ck_dispositivos_estado", "dispositivos", type_="check")
    op.drop_constraint("ck_usuario_email_nao_vazio", "dados_usuario", type_="check")
    op.drop_constraint("ck_fornecedor_codigo_nao_vazio", "fornecedor", type_="check")
    op.drop_constraint("ck_cliente_mid_nao_vazio", "cliente", type_="check")
    op.drop_constraint("ck_dispositivos_serial_nao_vazio", "dispositivos", type_="check")

    op.execute("DROP TRIGGER IF EXISTS trg_dados_usuario_before_write ON dados_usuario;")
    op.execute("DROP TRIGGER IF EXISTS trg_fornecedor_before_write ON fornecedor;")
    op.execute("DROP TRIGGER IF EXISTS trg_cliente_before_write ON cliente;")
    op.execute("DROP TRIGGER IF EXISTS trg_dispositivos_before_write ON dispositivos;")
    op.execute("DROP FUNCTION IF EXISTS estoque_usuario_before_write();")
    op.execute("DROP FUNCTION IF EXISTS estoque_fornecedor_before_write();")
    op.execute("DROP FUNCTION IF EXISTS estoque_cliente_before_write();")
    op.execute("DROP FUNCTION IF EXISTS estoque_dispositivos_before_write();")
