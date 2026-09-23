"""movimentacao_maquina

Revision ID: b1f056a2a162
Revises: a7c8e9f0b1d2
Create Date: 2026-09-23 08:29:34.468003

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1f056a2a162'
down_revision: Union[str, Sequence[str], None] = 'a7c8e9f0b1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "movimentacao_maquina",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=30), nullable=False),
        sa.Column("dispositivo_id", sa.Integer(), nullable=True),
        sa.Column("cliente_id", sa.Integer(), nullable=True),
        sa.Column("evento_id", sa.Integer(), nullable=True),
        sa.Column("numero_serial", sa.String(length=15), nullable=False),
        sa.Column("modelo", sa.String(length=15), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.CheckConstraint(
            "tipo IN ('VINCULO_CLIENTE', 'DESVINCULO_CLIENTE', 'ENTRADA_EVENTO', 'SAIDA_EVENTO')",
            name="ck_movimentacao_tipo",
        ),
        sa.ForeignKeyConstraint(["cliente_id"], ["cliente.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["dispositivo_id"], ["dispositivos.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["evento_id"], ["evento.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_movimentacao_maquina_id"), "movimentacao_maquina", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_movimentacao_maquina_id"), table_name="movimentacao_maquina")
    op.drop_table("movimentacao_maquina")
