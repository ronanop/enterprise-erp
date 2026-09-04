"""Explicit procurement stock units (added on GRN receipt, not billed portion)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic import op

revision: str = "0473_proc_inventory_stock_unit"
down_revision: str | None = "0472_proc_receipt_billing_columns_repair"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "proc_inventory_stock_unit",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_header_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_line_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receipt_batch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_name", sa.String(255), nullable=False),
        sa.Column("grn_number", sa.String(80), nullable=False),
        sa.Column("receipt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("unit_index", sa.Integer(), nullable=False),
        sa.Column("serial_number", sa.String(120), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["order_header_id"],
            ["procurement.proc_order_header.id"],
            name="fk_proc_isu_order_header",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["order_line_id"],
            ["procurement.proc_order_line.id"],
            name="fk_proc_isu_order_line",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["receipt_batch_id"],
            ["procurement.proc_order_receipt_batch.id"],
            name="fk_proc_isu_receipt_batch",
            ondelete="RESTRICT",
        ),
        schema="procurement",
    )
    op.create_index(
        "ix_proc_inventory_stock_unit_order_header_id",
        "proc_inventory_stock_unit",
        ["order_header_id"],
        schema="procurement",
    )
    op.create_index(
        "ix_proc_inventory_stock_unit_receipt_batch_id",
        "proc_inventory_stock_unit",
        ["receipt_batch_id"],
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_proc_inventory_stock_unit_receipt_batch_id",
        table_name="proc_inventory_stock_unit",
        schema="procurement",
    )
    op.drop_index(
        "ix_proc_inventory_stock_unit_order_header_id",
        table_name="proc_inventory_stock_unit",
        schema="procurement",
    )
    op.drop_table("proc_inventory_stock_unit", schema="procurement")
