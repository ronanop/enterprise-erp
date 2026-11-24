"""Procurement invoice generation tasks for Accounts My Jobs."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0651_proc_invoice_generation_task"
down_revision: str | Sequence[str] | None = "0650_proc_approval_step_owner"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "proc_invoice_generation_task",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=False),
        sa.Column("task_code", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("order_header_id", sa.UUID(), nullable=False),
        sa.Column("receipt_batch_id", sa.UUID(), nullable=False),
        sa.Column("grn_number", sa.String(length=80), nullable=False),
        sa.Column("purchase_order_number", sa.String(length=100), nullable=False),
        sa.Column("vendor_name", sa.String(length=255), nullable=False),
        sa.Column("customer_name", sa.String(length=255), nullable=False),
        sa.Column("items_summary", sa.String(length=500), nullable=False),
        sa.Column("assigned_user_id", sa.UUID(), nullable=False),
        sa.Column("requested_by", sa.UUID(), nullable=True),
        sa.Column("invoice_number", sa.String(length=80), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("invoice_quantity", sa.Numeric(18, 4), nullable=True),
        sa.Column("invoice_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_by", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.UUID(), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["foundation.sec_tenant.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["company_id"], ["organization.org_company.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "receipt_batch_id",
            "assigned_user_id",
            name="uk_proc_igt_tenant_batch_assignee",
        ),
        schema="procurement",
    )
    op.create_index(
        "ix_proc_invoice_generation_task_tenant_id",
        "proc_invoice_generation_task",
        ["tenant_id"],
        unique=False,
        schema="procurement",
    )
    op.create_index(
        "ix_proc_invoice_generation_task_status",
        "proc_invoice_generation_task",
        ["status"],
        unique=False,
        schema="procurement",
    )
    op.create_index(
        "ix_proc_invoice_generation_task_order_header_id",
        "proc_invoice_generation_task",
        ["order_header_id"],
        unique=False,
        schema="procurement",
    )
    op.create_index(
        "ix_proc_invoice_generation_task_receipt_batch_id",
        "proc_invoice_generation_task",
        ["receipt_batch_id"],
        unique=False,
        schema="procurement",
    )
    op.create_index(
        "ix_proc_invoice_generation_task_assigned_user_id",
        "proc_invoice_generation_task",
        ["assigned_user_id"],
        unique=False,
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_proc_invoice_generation_task_assigned_user_id",
        table_name="proc_invoice_generation_task",
        schema="procurement",
    )
    op.drop_index(
        "ix_proc_invoice_generation_task_receipt_batch_id",
        table_name="proc_invoice_generation_task",
        schema="procurement",
    )
    op.drop_index(
        "ix_proc_invoice_generation_task_order_header_id",
        table_name="proc_invoice_generation_task",
        schema="procurement",
    )
    op.drop_index(
        "ix_proc_invoice_generation_task_status",
        table_name="proc_invoice_generation_task",
        schema="procurement",
    )
    op.drop_index(
        "ix_proc_invoice_generation_task_tenant_id",
        table_name="proc_invoice_generation_task",
        schema="procurement",
    )
    op.drop_table("proc_invoice_generation_task", schema="procurement")
