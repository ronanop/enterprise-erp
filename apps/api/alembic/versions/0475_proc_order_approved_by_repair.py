"""Repair approved_by_name on proc_order_header if 0474 was not applied."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0475_proc_order_approved_by_repair"
down_revision: str | None = "0474_proc_order_approved_by_name"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "proc_order_header",
        sa.Column("approved_by_name", sa.String(length=255), nullable=True),
        schema="procurement",
    )


def downgrade() -> None:
    pass
