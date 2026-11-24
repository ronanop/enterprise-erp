"""Procurement PO approval step owners + scm_approval_stage on orders."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0650_proc_approval_step_owner"
down_revision: str | Sequence[str] | None = "0649_crm_lead_presales_call_gate"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "proc_approval_step_owner",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("step_key", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "step_key",
            "user_id",
            name="uk_proc_approval_step_owner_tenant_step_user",
        ),
        schema="procurement",
    )
    op.create_index(
        "ix_proc_approval_step_owner_tenant_id",
        "proc_approval_step_owner",
        ["tenant_id"],
        unique=False,
        schema="procurement",
    )
    op.create_index(
        "ix_proc_approval_step_owner_step_key",
        "proc_approval_step_owner",
        ["step_key"],
        unique=False,
        schema="procurement",
    )
    op.create_index(
        "ix_proc_approval_step_owner_user_id",
        "proc_approval_step_owner",
        ["user_id"],
        unique=False,
        schema="procurement",
    )

    op.add_column(
        "proc_order_header",
        sa.Column("scm_approval_stage", sa.String(length=32), nullable=True),
        schema="procurement",
    )
    op.create_check_constraint(
        "ck_proc_oh_scm_approval_stage",
        "proc_order_header",
        "scm_approval_stage IS NULL OR scm_approval_stage IN ('accept_po', 'management')",
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_proc_oh_scm_approval_stage",
        "proc_order_header",
        schema="procurement",
        type_="check",
    )
    op.drop_column("proc_order_header", "scm_approval_stage", schema="procurement")
    op.drop_index(
        "ix_proc_approval_step_owner_user_id",
        table_name="proc_approval_step_owner",
        schema="procurement",
    )
    op.drop_index(
        "ix_proc_approval_step_owner_step_key",
        table_name="proc_approval_step_owner",
        schema="procurement",
    )
    op.drop_index(
        "ix_proc_approval_step_owner_tenant_id",
        table_name="proc_approval_step_owner",
        schema="procurement",
    )
    op.drop_table("proc_approval_step_owner", schema="procurement")
