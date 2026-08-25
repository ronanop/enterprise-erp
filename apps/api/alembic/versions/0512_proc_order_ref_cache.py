"""Add order_ref_cache on proc_order_header for PO PDF Order Ref. Cache."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0512_proc_order_ref_cache"
down_revision: str | None = "0511_proc_grn_reversal"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "proc_order_header",
        sa.Column("order_ref_cache", sa.String(length=100), nullable=True),
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_column("proc_order_header", "order_ref_cache", schema="procurement")
