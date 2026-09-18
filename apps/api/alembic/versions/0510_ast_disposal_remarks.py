"""Disposal approval fields + single-step CEO workflow.

Adds remarks / CEO instruction / rejection / completion columns on
ast_asset_disposal and collapses AST_DISPOSAL_APPROVAL to one CEO step
so a single approve completes the workflow instance.
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0510_ast_disposal_remarks"
down_revision: str | None = "0509_ast_operational_in_maintenance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ast_asset_disposal",
        sa.Column("remarks", sa.Text(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_disposal",
        sa.Column("ceo_instruction", sa.Text(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_disposal",
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_disposal",
        sa.Column("previous_operational_status", sa.String(length=40), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_disposal",
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_disposal",
        sa.Column("approved_by", sa.Uuid(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_disposal",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_disposal",
        sa.Column("completed_by", sa.Uuid(), nullable=True),
        schema="asset",
    )

    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    workflows = conn.execute(
        sa.text(
            """
            SELECT d.id, d.tenant_id
            FROM foundation.wf_definition d
            WHERE d.workflow_code = 'AST_DISPOSAL_APPROVAL'
              AND d.is_active = true
            """
        )
    ).fetchall()
    for workflow_id, tenant_id in workflows:
        conn.execute(
            sa.text("DELETE FROM foundation.wf_step WHERE workflow_id = :workflow_id"),
            {"workflow_id": workflow_id},
        )
        conn.execute(
            sa.text(
                """
                INSERT INTO foundation.wf_step (
                    id, tenant_id, workflow_id, step_order, step_code, step_name,
                    approver_type, created_at, updated_at, created_by, updated_by
                ) VALUES (
                    :id, :tenant_id, :workflow_id, 1, 'CEO', 'CEO Disposal Approval',
                    'role', :now, :now, NULL, NULL
                )
                """
            ),
            {
                "id": str(uuid4()),
                "tenant_id": str(tenant_id),
                "workflow_id": str(workflow_id),
                "now": now,
            },
        )


def downgrade() -> None:
    op.drop_column("ast_asset_disposal", "completed_by", schema="asset")
    op.drop_column("ast_asset_disposal", "completed_at", schema="asset")
    op.drop_column("ast_asset_disposal", "approved_by", schema="asset")
    op.drop_column("ast_asset_disposal", "approved_at", schema="asset")
    op.drop_column("ast_asset_disposal", "previous_operational_status", schema="asset")
    op.drop_column("ast_asset_disposal", "rejection_reason", schema="asset")
    op.drop_column("ast_asset_disposal", "ceo_instruction", schema="asset")
    op.drop_column("ast_asset_disposal", "remarks", schema="asset")
