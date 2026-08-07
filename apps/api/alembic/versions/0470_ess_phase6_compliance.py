"""ESS Phase 6: policy walkthroughs and password change flag."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0470_ess_phase6_compliance"
down_revision: str | None = "0469_ess_phase3_attendance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sec_user",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        schema="foundation",
    )

    op.create_table(
        "hr_ess_policy",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_code", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("policy_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("content_markdown", sa.Text(), nullable=False),
        sa.Column("is_mandatory", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="published"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["company_id"], ["organization.org_company.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["foundation.sec_tenant.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "policy_code", name="uk_hr_ess_policy_company_code"),
        sa.CheckConstraint(
            "status IN ('draft','published','archived')",
            name="ck_hr_ess_policy_status",
        ),
        schema="hr",
    )
    op.create_index("ix_hr_ess_policy_status", "hr_ess_policy", ["status"], schema="hr")

    op.create_table(
        "hr_ess_policy_ack",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_version", sa.Integer(), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["company_id"], ["organization.org_company.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["master.master_employee.id"]),
        sa.ForeignKeyConstraint(["policy_id"], ["hr.hr_ess_policy.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["foundation.sec_tenant.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "employee_id",
            "policy_id",
            "policy_version",
            name="uk_hr_ess_policy_ack_emp_policy_ver",
        ),
        schema="hr",
    )
    op.create_index(
        "ix_hr_ess_policy_ack_employee",
        "hr_ess_policy_ack",
        ["employee_id"],
        schema="hr",
    )


def downgrade() -> None:
    op.drop_index("ix_hr_ess_policy_ack_employee", table_name="hr_ess_policy_ack", schema="hr")
    op.drop_table("hr_ess_policy_ack", schema="hr")
    op.drop_index("ix_hr_ess_policy_status", table_name="hr_ess_policy", schema="hr")
    op.drop_table("hr_ess_policy", schema="hr")
    op.drop_column("sec_user", "must_change_password", schema="foundation")
