"""tag parceiro em cliente; maquina.adquirente -> cliente

Revision ID: e1b2c3d4e5f6
Revises: d9e5f2a1b4c3
Create Date: 2026-09-15 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "d9e5f2a1b4c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cliente",
        sa.Column("parceiro", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # UPDATE revalida CHECKs; o NOT VALID do estoque legado falharia.
    op.execute("ALTER TABLE dispositivos DROP CONSTRAINT IF EXISTS ck_dispositivos_estoque;")
    op.execute("ALTER TABLE dispositivos DISABLE TRIGGER trg_dispositivos_before_write;")
    op.execute("UPDATE dispositivos SET adquirente = NULL;")
    op.execute("ALTER TABLE dispositivos ENABLE TRIGGER trg_dispositivos_before_write;")
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
    op.drop_constraint("fk_dispositivos_adquirente", "dispositivos", type_="foreignkey")
    op.create_foreign_key(
        "fk_dispositivos_adquirente",
        "dispositivos",
        "cliente",
        ["adquirente"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_dispositivos_adquirente", "dispositivos", type_="foreignkey")
    op.execute("UPDATE dispositivos SET adquirente = NULL")
    op.create_foreign_key(
        "fk_dispositivos_adquirente",
        "dispositivos",
        "adquirente",
        ["adquirente"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_column("cliente", "parceiro")
