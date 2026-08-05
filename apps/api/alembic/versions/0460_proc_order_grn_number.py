"""Add sequential GRN number on PO receipt batches (PO/.../001)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0460_proc_order_grn_number"
down_revision: str | None = "0459_proc_order_last_receipt"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "proc_order_header",
        sa.Column("grn_sequence", sa.Integer(), nullable=False, server_default="0"),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_header",
        sa.Column("current_grn_number", sa.String(80), nullable=True),
        schema="procurement",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("proc_order_header", "current_grn_number", schema="procurement")
    op.drop_column("proc_order_header", "grn_sequence", schema="procurement")
