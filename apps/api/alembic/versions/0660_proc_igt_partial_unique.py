"""Partial unique on invoice generation task (active rows only).

Revision ID: 0660_proc_igt_partial_unique
Revises: 0659_proc_receipt_batch_vendor_dispatch
Create Date: 2026-10-30
"""

from __future__ import annotations

from alembic import op

revision: str = "0660_proc_igt_partial_unique"
down_revision: str | None = "0659_proc_receipt_batch_vendor_dispatch"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE procurement.proc_invoice_generation_task "
        "DROP CONSTRAINT IF EXISTS uk_proc_igt_tenant_batch_assignee"
    )
    op.execute("DROP INDEX IF EXISTS procurement.uk_proc_igt_tenant_batch_assignee")
    op.execute(
        """
        CREATE UNIQUE INDEX uk_proc_igt_tenant_batch_assignee
          ON procurement.proc_invoice_generation_task
            (tenant_id, receipt_batch_id, assigned_user_id)
          WHERE is_deleted = false
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS procurement.uk_proc_igt_tenant_batch_assignee")
    op.create_unique_constraint(
        "uk_proc_igt_tenant_batch_assignee",
        "proc_invoice_generation_task",
        ["tenant_id", "receipt_batch_id", "assigned_user_id"],
        schema="procurement",
    )
