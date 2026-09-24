"""tabela distribuidor

Revision ID: c3d8e1f4a2b7
Revises: 5484078bdc0c
Create Date: 2026-09-24 10:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d8e1f4a2b7"
down_revision: Union[str, Sequence[str], None] = "5484078bdc0c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "distribuidor",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("nome_fantasia", sa.String(length=255), nullable=True),
        sa.Column("documento", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.CheckConstraint("nome <> ''", name="ck_distribuidor_nome_nao_vazio"),
        sa.CheckConstraint("documento IS NULL OR documento <> ''", name="ck_distribuidor_documento_nao_vazio"),
    )
    op.create_index("ix_distribuidor_id", "distribuidor", ["id"], unique=False)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_distribuidor_documento
        ON distribuidor (documento)
        WHERE documento IS NOT NULL AND documento <> '';
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_distribuidor_documento;")
    op.drop_index("ix_distribuidor_id", table_name="distribuidor")
    op.drop_table("distribuidor")
