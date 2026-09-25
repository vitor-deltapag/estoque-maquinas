"""permissoes por usuario e perfil operacional

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-09-25 09:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a6b7c8d9e0f1"
down_revision: Union[str, Sequence[str], None] = "f5a6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("dados_usuario", sa.Column("permissoes", sa.JSON(), nullable=True))
    op.execute("UPDATE dados_usuario SET perfil = 'OPERACIONAL' WHERE perfil = 'COMUM' OR perfil IS NULL")


def downgrade() -> None:
    op.execute("UPDATE dados_usuario SET perfil = 'COMUM' WHERE perfil = 'OPERACIONAL'")
    op.drop_column("dados_usuario", "permissoes")
