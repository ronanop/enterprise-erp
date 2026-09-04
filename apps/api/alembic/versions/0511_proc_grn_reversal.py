"""GRN receipt-batch reversal audit fields and inventory adjustment ledger."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic import op

from helpers import add_column_if_missing, table_exists  # noqa: E402

revision: str = "0511_proc_grn_reversal"
down_revision: str | Sequence[str] | None = "0510_proc_inventory_stock_qty"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "proc_order_receipt_batch",
        sa.Column(
            "reversal_status",
            sa.String(20),
            nullable=False,
            server_default="posted",
        ),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_receipt_batch",
        sa.Column("reversed_at", sa.DateTime(timezone=True), nullable=True),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_receipt_batch",
        sa.Column("reversed_by", postgresql.UUID(as_uuid=True), nullable=True),
        schema="procurement",
    )
    add_column_if_missing(
        "proc_order_receipt_batch",
        sa.Column("reversal_reason", sa.String(2000), nullable=True),
        schema="procurement",
    )

    bind = op.get_bind()
    if table_exists(bind, "proc_inventory_stock_adjustment", schema="procurement"):
        return
    op.create_table(
        "proc_inventory_stock_adjustment",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("receipt_batch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_header_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_line_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stock_unit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("product_name", sa.String(255), nullable=False),
        sa.Column("grn_number", sa.String(80), nullable=False),
        sa.Column("serial_number", sa.String(120), nullable=False),
        sa.Column("unit_index", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("reason", sa.String(2000), nullable=False),
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
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["receipt_batch_id"],
            ["procurement.proc_order_receipt_batch.id"],
            name="fk_proc_isa_receipt_batch",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["order_header_id"],
            ["procurement.proc_order_header.id"],
            name="fk_proc_isa_order_header",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["order_line_id"],
            ["procurement.proc_order_line.id"],
            name="fk_proc_isa_order_line",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["stock_unit_id"],
            ["procurement.proc_inventory_stock_unit.id"],
            name="fk_proc_isa_stock_unit",
            ondelete="RESTRICT",
        ),
        schema="procurement",
    )
    op.create_index(
        "ix_proc_inventory_stock_adjustment_receipt_batch_id",
        "proc_inventory_stock_adjustment",
        ["receipt_batch_id"],
        schema="procurement",
    )
    op.create_index(
        "ix_proc_inventory_stock_adjustment_order_header_id",
        "proc_inventory_stock_adjustment",
        ["order_header_id"],
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_proc_inventory_stock_adjustment_order_header_id",
        table_name="proc_inventory_stock_adjustment",
        schema="procurement",
    )
    op.drop_index(
        "ix_proc_inventory_stock_adjustment_receipt_batch_id",
        table_name="proc_inventory_stock_adjustment",
        schema="procurement",
    )
    op.drop_table("proc_inventory_stock_adjustment", schema="procurement")
    op.drop_column("proc_order_receipt_batch", "reversal_reason", schema="procurement")
    op.drop_column("proc_order_receipt_batch", "reversed_by", schema="procurement")
    op.drop_column("proc_order_receipt_batch", "reversed_at", schema="procurement")
    op.drop_column("proc_order_receipt_batch", "reversal_status", schema="procurement")
