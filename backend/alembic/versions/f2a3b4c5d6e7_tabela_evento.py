"""tabela evento e vinculo com maquinas

Revision ID: f2a3b4c5d6e7
Revises: e1b2c3d4e5f6
Create Date: 2026-09-15 14:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, Sequence[str], None] = "e1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "evento",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("nome", sa.String(length=255), nullable=True),
        sa.Column("cliente_id", sa.Integer(), nullable=False),
        sa.Column("data_inicio", sa.Date(), nullable=False),
        sa.Column("data_fim", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ABERTO"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("data_finalizacao", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["cliente_id"], ["cliente.id"]),
        sa.CheckConstraint("status IN ('ABERTO', 'FINALIZADO')", name="ck_evento_status"),
        sa.CheckConstraint("data_fim >= data_inicio", name="ck_evento_datas"),
    )
    op.create_index("ix_evento_id", "evento", ["id"], unique=False)
    op.create_table(
        "evento_dispositivo",
        sa.Column("evento_id", sa.Integer(), nullable=False),
        sa.Column("dispositivo_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["evento_id"], ["evento.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dispositivo_id"], ["dispositivos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("evento_id", "dispositivo_id"),
    )
    op.add_column("dispositivos", sa.Column("evento_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_dispositivos_evento",
        "dispositivos",
        "evento",
        ["evento_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_dispositivos_evento", "dispositivos", type_="foreignkey")
    op.drop_column("dispositivos", "evento_id")
    op.drop_table("evento_dispositivo")
    op.drop_index("ix_evento_id", table_name="evento")
    op.drop_table("evento")
