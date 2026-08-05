"""Track last receipt qty/batch for GRN PDF (latest save only)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0459_proc_order_last_receipt"
down_revision: str | None = "0458_crm_ovf_scm_on_hold"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "proc_order_header",
        sa.Column("current_receipt_batch_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_header",
        sa.Column("current_receipt_batch_at", sa.DateTime(timezone=True), nullable=True),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_line",
        sa.Column(
            "last_receipt_qty",
            sa.Numeric(18, 4),
            nullable=False,
            server_default="0",
        ),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_line",
        sa.Column("last_receipt_at", sa.DateTime(timezone=True), nullable=True),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_line",
        sa.Column("last_receipt_batch_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="procurement",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("proc_order_line", "last_receipt_batch_id", schema="procurement")
    op.drop_column("proc_order_line", "last_receipt_at", schema="procurement")
    op.drop_column("proc_order_line", "last_receipt_qty", schema="procurement")
    op.drop_column("proc_order_header", "current_receipt_batch_at", schema="procurement")
    op.drop_column("proc_order_header", "current_receipt_batch_id", schema="procurement")
