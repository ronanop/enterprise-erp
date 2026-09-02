"""Billing quantity per receipt batch line (partial billing within received qty)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0471_proc_receipt_billing_quantity"
down_revision: str | None = "0470_proc_receipt_line_billing_repair"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "proc_order_line",
        sa.Column(
            "last_receipt_billing_quantity",
            sa.Numeric(18, 4),
            nullable=False,
            server_default="0",
        ),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_receipt_batch_line",
        sa.Column(
            "billing_quantity",
            sa.Numeric(18, 4),
            nullable=False,
            server_default="0",
        ),
        schema="procurement",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("proc_order_receipt_batch_line", "billing_quantity", schema="procurement")
    op.drop_column("proc_order_line", "last_receipt_billing_quantity", schema="procurement")
