"""Add soft-delete audit columns on receipt batch tables (ORM parity)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0464_proc_receipt_batch_soft_delete"
down_revision: str | None = "0463_proc_order_receipt_batch"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table in ("proc_order_receipt_batch", "proc_order_receipt_batch_line"):
        add_column_if_missing(
            table,
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            schema="procurement",
        )
        add_column_if_missing(
            table,
            sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
            schema="procurement",
        )


def downgrade() -> None:
    from alembic import op

    for table in ("proc_order_receipt_batch_line", "proc_order_receipt_batch"):
        op.drop_column(table, "deleted_by", schema="procurement")
        op.drop_column(table, "deleted_at", schema="procurement")
