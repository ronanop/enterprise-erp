"""Store quote revision snapshots for negotiation history."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import table_exists

revision: str = "0652_crm_quote_revision_snapshot"
down_revision: str | None = "0651_proc_invoice_generation_task"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if table_exists(bind, "crm_quote_revision_snapshot", schema="crm"):
        return
    op.create_table(
        "crm_quote_revision_snapshot",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quote_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("revision_no", sa.Integer(), nullable=False),
        sa.Column("avg_margin_pct", sa.Numeric(6, 3), nullable=False, server_default="0"),
        sa.Column("grand_total", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("total_margin_amount", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["quote_id"], ["crm.crm_quote.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["foundation.sec_tenant.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["company_id"], ["organization.org_company.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("quote_id", "revision_no", name="uk_crm_quote_rev_snap_quote_rev"),
        schema="crm",
    )
    op.create_index(
        "ix_crm_quote_rev_snap_quote_id",
        "crm_quote_revision_snapshot",
        ["quote_id"],
        schema="crm",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if not table_exists(bind, "crm_quote_revision_snapshot", schema="crm"):
        return
    op.drop_index("ix_crm_quote_rev_snap_quote_id", table_name="crm_quote_revision_snapshot", schema="crm")
    op.drop_table("crm_quote_revision_snapshot", schema="crm")
