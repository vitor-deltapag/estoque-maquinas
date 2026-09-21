"""fk dispositivos.adquirente -> adquirente.id

Revision ID: c8d4e1f2a3b0
Revises: b7c91a2e4d10
Create Date: 2026-09-15 13:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8d4e1f2a3b0"
down_revision: Union[str, Sequence[str], None] = "b7c91a2e4d10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "adquirente",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("nome", sa.String(length=100), nullable=True),
    )
    op.create_index("ix_adquirente_id", "adquirente", ["id"], unique=False)
    op.create_index("ix_adquirente_nome", "adquirente", ["nome"], unique=False)
    op.add_column("dispositivos", sa.Column("adquirente", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_dispositivos_adquirente",
        "dispositivos",
        "adquirente",
        ["adquirente"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_dispositivos_adquirente", "dispositivos", type_="foreignkey")
    op.drop_column("dispositivos", "adquirente")
    op.drop_index("ix_adquirente_nome", table_name="adquirente")
    op.drop_index("ix_adquirente_id", table_name="adquirente")
    op.drop_table("adquirente")
