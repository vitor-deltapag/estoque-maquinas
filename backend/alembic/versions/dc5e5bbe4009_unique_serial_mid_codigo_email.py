"""unique serial mid codigo email

Revision ID: dc5e5bbe4009
Revises: 
Create Date: 2026-09-14 09:01:51.738573

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dc5e5bbe4009'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_dispositivos_numero_serial
        ON dispositivos (numero_serial)
        WHERE numero_serial IS NOT NULL AND numero_serial <> '';
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_mid
        ON cliente (mid)
        WHERE mid IS NOT NULL AND mid <> '';
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_fornecedor_codigo
        ON fornecedor (codigo)
        WHERE codigo IS NOT NULL AND codigo <> '';
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_dados_usuario_email
        ON dados_usuario (email)
        WHERE email IS NOT NULL AND email <> '';
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_dispositivos_numero_serial;")
    op.execute("DROP INDEX IF EXISTS uq_cliente_mid;")
    op.execute("DROP INDEX IF EXISTS uq_fornecedor_codigo;")
    op.execute("DROP INDEX IF EXISTS uq_dados_usuario_email;")
