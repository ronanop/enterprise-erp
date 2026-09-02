"""OVF fulfill-from-stock allocations (procurement inventory units)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic import op

from helpers import table_exists  # noqa: E402

revision: str = "0514_proc_ovf_stock_allocation"
down_revision: str | Sequence[str] | None = "0513_proc_order_line_rate_currency"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if table_exists(bind, "proc_ovf_stock_allocation", schema="procurement"):
        return
    op.create_table(
        "proc_ovf_stock_allocation",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ovf_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stock_unit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_name", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
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
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["ovf_id"],
            ["crm.crm_ovf.id"],
            name="fk_proc_ovf_stock_allocation_ovf",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["stock_unit_id"],
            ["procurement.proc_inventory_stock_unit.id"],
            name="fk_proc_ovf_stock_allocation_unit",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("stock_unit_id", name="uk_proc_ovf_stock_allocation_unit"),
        schema="procurement",
    )
    op.create_index(
        "ix_proc_ovf_stock_allocation_ovf_id",
        "proc_ovf_stock_allocation",
        ["ovf_id"],
        schema="procurement",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if not table_exists(bind, "proc_ovf_stock_allocation", schema="procurement"):
        return
    op.drop_index(
        "ix_proc_ovf_stock_allocation_ovf_id",
        table_name="proc_ovf_stock_allocation",
        schema="procurement",
    )
    op.drop_table("proc_ovf_stock_allocation", schema="procurement")
