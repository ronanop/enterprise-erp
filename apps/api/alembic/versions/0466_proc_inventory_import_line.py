"""Excel-imported procurement inventory lines."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic import op

revision: str = "0466_proc_inventory_import_line"
down_revision: str | None = "0465_proc_receipt_serial_numbers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "proc_inventory_import_line",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_name", sa.String(255), nullable=False),
        sa.Column("serial_number", sa.String(120), nullable=False),
        sa.Column("order_header_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("company_po_number", sa.String(50), nullable=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["order_header_id"],
            ["procurement.proc_order_header.id"],
            name="fk_proc_iil_order_header",
            ondelete="RESTRICT",
        ),
        schema="procurement",
    )
    op.create_index(
        "ix_proc_inventory_import_line_order_header_id",
        "proc_inventory_import_line",
        ["order_header_id"],
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_proc_inventory_import_line_order_header_id",
        table_name="proc_inventory_import_line",
        schema="procurement",
    )
    op.drop_table("proc_inventory_import_line", schema="procurement")
