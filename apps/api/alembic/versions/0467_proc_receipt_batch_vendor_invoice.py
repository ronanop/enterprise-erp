"""Vendor invoice fields on GRN receipt batches."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic import op

revision: str = "0467_proc_receipt_batch_vendor_invoice"
down_revision: str | None = "0466_proc_inventory_import_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "proc_order_receipt_batch",
        sa.Column("vendor_invoice_number", sa.String(80), nullable=True),
        schema="procurement",
    )
    op.add_column(
        "proc_order_receipt_batch",
        sa.Column("vendor_invoice_date", sa.Date(), nullable=True),
        schema="procurement",
    )
    op.add_column(
        "proc_order_receipt_batch",
        sa.Column("vendor_invoice_quantity", sa.Numeric(18, 4), nullable=True),
        schema="procurement",
    )
    op.add_column(
        "proc_order_receipt_batch",
        sa.Column("vendor_invoice_subtotal", sa.Numeric(18, 4), nullable=True),
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_column("proc_order_receipt_batch", "vendor_invoice_subtotal", schema="procurement")
    op.drop_column("proc_order_receipt_batch", "vendor_invoice_quantity", schema="procurement")
    op.drop_column("proc_order_receipt_batch", "vendor_invoice_date", schema="procurement")
    op.drop_column("proc_order_receipt_batch", "vendor_invoice_number", schema="procurement")
