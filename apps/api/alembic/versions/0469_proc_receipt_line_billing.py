"""Billing flag on receipt lines (order line + receipt batch line)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0469_proc_receipt_line_billing"
down_revision: str | None = "0468_crm_attachment_vendor_invoice_category"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "proc_order_line",
        sa.Column(
            "last_receipt_billing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_receipt_batch_line",
        sa.Column(
            "billing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        schema="procurement",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("proc_order_receipt_batch_line", "billing", schema="procurement")
    op.drop_column("proc_order_line", "last_receipt_billing", schema="procurement")
