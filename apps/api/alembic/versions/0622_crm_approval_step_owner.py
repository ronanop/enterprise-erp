"""CRM configurable default My Jobs step owners."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0622_crm_approval_step_owner"
down_revision: str | Sequence[str] | None = "0621_prj_po_queue_seed_handoff"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "crm_approval_step_owner",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("step_key", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
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
            name="uk_crm_approval_step_owner_tenant_step_user",
        ),
        schema="crm",
    )
    op.create_index(
        "ix_crm_approval_step_owner_tenant_id",
        "crm_approval_step_owner",
        ["tenant_id"],
        unique=False,
        schema="crm",
    )
    op.create_index(
        "ix_crm_approval_step_owner_step_key",
        "crm_approval_step_owner",
        ["step_key"],
        unique=False,
        schema="crm",
    )
    op.create_index(
        "ix_crm_approval_step_owner_user_id",
        "crm_approval_step_owner",
        ["user_id"],
        unique=False,
        schema="crm",
    )

    # Seed from legacy hardcoded emails when those users exist.
    op.execute(
        sa.text(
            """
            INSERT INTO crm.crm_approval_step_owner (
                id, tenant_id, step_key, user_id, created_at, is_deleted, version
            )
            SELECT
                gen_random_uuid(),
                u.tenant_id,
                s.step_key,
                u.id,
                now(),
                false,
                1
            FROM foundation.sec_user u
            CROSS JOIN (
                VALUES
                    ('quote_send_for_approval', 'shraddha@cachedigitech.com'),
                    ('quote_send_for_approval', 'vinod@cachedigitech.com'),
                    ('quote_send_for_approval', 'prarthana@cachedigitech.com'),
                    ('ovf_send_for_approval', 'shraddha@cachedigitech.com'),
                    ('ovf_send_for_approval', 'vinod@cachedigitech.com'),
                    ('ovf_send_for_approval', 'prarthana@cachedigitech.com'),
                    ('po_finance', 'accounts@cachedigitech.com'),
                    ('po_finance', 'navneet.kumar@cachedigitech.com')
            ) AS s(step_key, email)
            WHERE lower(u.email) = lower(s.email)
              AND u.is_deleted = false
            ON CONFLICT DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_crm_approval_step_owner_user_id", table_name="crm_approval_step_owner", schema="crm")
    op.drop_index("ix_crm_approval_step_owner_step_key", table_name="crm_approval_step_owner", schema="crm")
    op.drop_index("ix_crm_approval_step_owner_tenant_id", table_name="crm_approval_step_owner", schema="crm")
    op.drop_table("crm_approval_step_owner", schema="crm")
