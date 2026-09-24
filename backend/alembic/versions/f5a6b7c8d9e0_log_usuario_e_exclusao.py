"""usuario e exclusao no log de movimentacao

Revision ID: f5a6b7c8d9e0
Revises: e4f9a2b6c1d8
Create Date: 2026-09-24 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, Sequence[str], None] = "e4f9a2b6c1d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("movimentacao_maquina", sa.Column("usuario_nome", sa.String(length=255), nullable=True))
    op.drop_constraint("ck_movimentacao_tipo", "movimentacao_maquina", type_="check")
    op.create_check_constraint(
        "ck_movimentacao_tipo",
        "movimentacao_maquina",
        "tipo IN ('VINCULO_CLIENTE', 'DESVINCULO_CLIENTE', 'ENTRADA_EVENTO', 'SAIDA_EVENTO', 'EXCLUSAO')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_movimentacao_tipo", "movimentacao_maquina", type_="check")
    op.create_check_constraint(
        "ck_movimentacao_tipo",
        "movimentacao_maquina",
        "tipo IN ('VINCULO_CLIENTE', 'DESVINCULO_CLIENTE', 'ENTRADA_EVENTO', 'SAIDA_EVENTO')",
    )
    op.drop_column("movimentacao_maquina", "usuario_nome")
