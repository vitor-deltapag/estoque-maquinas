"""Aumentar serial do movimento

Revision ID: 5484078bdc0c
Revises: b1f056a2a162
Create Date: 2026-09-23 13:51:51.198959

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5484078bdc0c'
down_revision: Union[str, Sequence[str], None] = 'b1f056a2a162'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("movimentacao_maquina", "numero_serial", existing_type=sa.String(15), type_=sa.String(100), existing_nullable=False)
    op.alter_column("movimentacao_maquina", "modelo", existing_type=sa.String(15), type_=sa.String(50), existing_nullable=False)

def downgrade() -> None:
    op.alter_column("movimentacao_maquina", "modelo", existing_type=sa.String(50), type_=sa.String(15), existing_nullable=False)
    op.alter_column("movimentacao_maquina", "numero_serial", existing_type=sa.String(100), type_=sa.String(15), existing_nullable=False)

