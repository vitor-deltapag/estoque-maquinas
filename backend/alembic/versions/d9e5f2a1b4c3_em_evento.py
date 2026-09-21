"""em_evento nas maquinas

Revision ID: d9e5f2a1b4c3
Revises: c8d4e1f2a3b0
Create Date: 2026-09-15 14:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9e5f2a1b4c3"
down_revision: Union[str, Sequence[str], None] = "c8d4e1f2a3b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "dispositivos",
        sa.Column("em_evento", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("dispositivos", "em_evento")
