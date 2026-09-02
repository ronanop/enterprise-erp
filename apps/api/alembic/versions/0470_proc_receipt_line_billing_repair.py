"""Ensure receipt billing columns exist (repair if 0469 was stamped before columns were added)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0470_proc_receipt_line_billing_repair"
down_revision: str | None = "0469_proc_receipt_line_billing"
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
    pass
