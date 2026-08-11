"""Add company_po_number and entity_code on proc_order_header."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0457_proc_company_po_number"
down_revision: str | None = "0456_crm_oem_master"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "proc_order_header",
        sa.Column("company_po_number", sa.String(50), nullable=True),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_header",
        sa.Column("entity_code", sa.String(10), nullable=True),
        schema="procurement",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("proc_order_header", "entity_code", schema="procurement")
    op.drop_column("proc_order_header", "company_po_number", schema="procurement")
