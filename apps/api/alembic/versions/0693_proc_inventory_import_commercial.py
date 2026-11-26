"""Add Excel-aligned commercial fields to inventory import lines."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import column_exists  # noqa: E402

revision: str = "0693_proc_inventory_import_commercial"
down_revision: str | Sequence[str] | None = "0692_hr_workplace_task_transfer"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLS: list[tuple[str, sa.Column]] = [
    ("vendor_name", sa.Column("vendor_name", sa.String(length=255), nullable=True)),
    (
        "vendor_invoice_number",
        sa.Column("vendor_invoice_number", sa.String(length=120), nullable=True),
    ),
    ("vendor_invoice_date", sa.Column("vendor_invoice_date", sa.Date(), nullable=True)),
    ("part_no", sa.Column("part_no", sa.String(length=120), nullable=True)),
    ("customer_name", sa.Column("customer_name", sa.String(length=255), nullable=True)),
    ("sales_spoc", sa.Column("sales_spoc", sa.String(length=255), nullable=True)),
    ("payment_terms", sa.Column("payment_terms", sa.String(length=120), nullable=True)),
    ("payment_due_date", sa.Column("payment_due_date", sa.Date(), nullable=True)),
]


def upgrade() -> None:
    bind = op.get_bind()
    for name, col in _COLS:
        if column_exists(bind, "proc_inventory_import_line", name, schema="procurement"):
            continue
        op.add_column("proc_inventory_import_line", col, schema="procurement")


def downgrade() -> None:
    bind = op.get_bind()
    for name, _ in reversed(_COLS):
        if not column_exists(bind, "proc_inventory_import_line", name, schema="procurement"):
            continue
        op.drop_column("proc_inventory_import_line", name, schema="procurement")
