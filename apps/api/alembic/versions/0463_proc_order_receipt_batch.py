"""Persist GRN receipt batches and line qty per batch."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic import op

revision: str = "0463_proc_order_receipt_batch"
down_revision: str | None = "0462_crm_ovf_po_date"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("proc_order_receipt_batch", schema="procurement"):
        return

    op.create_table(
        "proc_order_receipt_batch",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_header_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("grn_number", sa.String(80), nullable=False),
        sa.Column("receipt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(
            ["order_header_id"],
            ["procurement.proc_order_header.id"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("order_header_id", "sequence", name="uk_proc_orb_header_seq"),
        schema="procurement",
    )
    op.create_index(
        "ix_proc_order_receipt_batch_order_header_id",
        "proc_order_receipt_batch",
        ["order_header_id"],
        schema="procurement",
    )

    op.create_table(
        "proc_order_receipt_batch_line",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("receipt_batch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_line_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(
            ["receipt_batch_id"],
            ["procurement.proc_order_receipt_batch.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["order_line_id"],
            ["procurement.proc_order_line.id"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "receipt_batch_id",
            "order_line_id",
            name="uk_proc_orbl_batch_line",
        ),
        schema="procurement",
    )
    op.create_index(
        "ix_proc_order_receipt_batch_line_receipt_batch_id",
        "proc_order_receipt_batch_line",
        ["receipt_batch_id"],
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_table("proc_order_receipt_batch_line", schema="procurement")
    op.drop_table("proc_order_receipt_batch", schema="procurement")
