"""Serial numbers on receipt (order line + receipt batch line)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0465_proc_receipt_serial_numbers"
down_revision: str | None = "0464_proc_receipt_batch_soft_delete"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "proc_order_line",
        sa.Column("last_receipt_serial_numbers", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_receipt_batch_line",
        sa.Column("serial_numbers", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="procurement",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("proc_order_receipt_batch_line", "serial_numbers", schema="procurement")
    op.drop_column("proc_order_line", "last_receipt_serial_numbers", schema="procurement")
