"""aquisicao comprada/alugada nas maquinas

Revision ID: a7c8e9f0b1d2
Revises: f2a3b4c5d6e7
Create Date: 2026-09-17 15:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7c8e9f0b1d2"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "dispositivos",
        sa.Column("aquisicao", sa.String(length=20), nullable=True),
    )
    # UPDATE revalida CHECKs; o NOT VALID do estoque legado falharia.
    op.execute("ALTER TABLE dispositivos DROP CONSTRAINT IF EXISTS ck_dispositivos_estoque;")
    op.execute("ALTER TABLE dispositivos DISABLE TRIGGER trg_dispositivos_before_write;")
    op.execute("UPDATE dispositivos SET aquisicao = 'ALUGADA' WHERE aquisicao IS NULL;")
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
    op.create_check_constraint(
        "ck_dispositivos_aquisicao",
        "dispositivos",
        "aquisicao IS NULL OR aquisicao IN ('COMPRADA', 'ALUGADA')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_dispositivos_aquisicao", "dispositivos", type_="check")
    op.drop_column("dispositivos", "aquisicao")
