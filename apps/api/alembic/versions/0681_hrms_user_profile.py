"""Cached HRMS user profile for organization directory."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0681_hrms_user_profile"
# Parallel branch off charge-request; merged in 0687 with assets head (0686).
# (CRM charge-request was renumbered 0680 → 0684 on main.)
down_revision: str | Sequence[str] | None = "0684_crm_ovf_charge_request"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hrms_user_profile",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=True),
        sa.Column("remote_id", sa.String(length=64), nullable=True),
        sa.Column("employee_code", sa.String(length=50), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("first_name", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("last_name", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("email", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("mobile", sa.String(length=30), nullable=False, server_default=""),
        sa.Column("designation", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("department", sa.String(length=150), nullable=False, server_default=""),
        sa.Column("manager", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("manager_code", sa.String(length=50), nullable=False, server_default=""),
        sa.Column("branch", sa.String(length=150), nullable=False, server_default=""),
        sa.Column("company", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
        sa.Column("date_of_joining", sa.String(length=20), nullable=True),
        sa.Column("date_of_leaving", sa.String(length=20), nullable=True),
        sa.Column("gender", sa.String(length=30), nullable=True),
        sa.Column("date_of_birth", sa.String(length=20), nullable=True),
        sa.Column("employment_type", sa.String(length=50), nullable=True),
        sa.Column("work_location", sa.String(length=150), nullable=True),
        sa.Column("is_manager", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("leave_balances", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("leave_balance_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("leave_used_total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("raw_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("profile_fetched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("leave_fetched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.UUID(), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["foundation.sec_tenant.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["foundation.sec_user.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["employee_id"], ["master.master_employee.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "user_id", name="uk_hrms_user_profile_tenant_user"),
        schema="foundation",
    )
    op.create_index(
        "ix_hrms_user_profile_tenant_id",
        "hrms_user_profile",
        ["tenant_id"],
        schema="foundation",
    )
    op.create_index(
        "ix_hrms_user_profile_user_id",
        "hrms_user_profile",
        ["user_id"],
        schema="foundation",
    )
    op.create_index(
        "ix_hrms_user_profile_employee_id",
        "hrms_user_profile",
        ["employee_id"],
        schema="foundation",
    )
    op.create_index(
        "ix_hrms_user_profile_employee_code",
        "hrms_user_profile",
        ["employee_code"],
        schema="foundation",
    )


def downgrade() -> None:
    op.drop_index("ix_hrms_user_profile_employee_code", table_name="hrms_user_profile", schema="foundation")
    op.drop_index("ix_hrms_user_profile_employee_id", table_name="hrms_user_profile", schema="foundation")
    op.drop_index("ix_hrms_user_profile_user_id", table_name="hrms_user_profile", schema="foundation")
    op.drop_index("ix_hrms_user_profile_tenant_id", table_name="hrms_user_profile", schema="foundation")
    op.drop_table("hrms_user_profile", schema="foundation")
