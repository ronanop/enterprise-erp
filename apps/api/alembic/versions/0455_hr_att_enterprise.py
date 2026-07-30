"""Attendance early_leave_minutes already on 0451; weekly-off + attendance rules."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0455_hr_att_enterprise"
down_revision: str | None = "0454_hr_profile_education_skills"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hr_weekly_off_policy",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("policy_code", sa.String(50), nullable=False),
        sa.Column("policy_name", sa.String(255), nullable=False),
        sa.Column("rules_json", postgresql.JSONB(), nullable=True),
        sa.Column("custom_weekdays_json", postgresql.JSONB(), nullable=True),
        sa.Column("alternate_saturday_start", sa.Date(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("company_id", "policy_code", name="uk_hr_weekly_off_company_code"),
        sa.CheckConstraint("status IN ('active','inactive')", name="ck_hr_weekly_off_status"),
        schema="hr",
    )
    op.create_index("ix_hr_weekly_off_status", "hr_weekly_off_policy", ["status"], schema="hr")
    op.create_index("ix_hr_weekly_off_branch", "hr_weekly_off_policy", ["branch_id"], schema="hr")

    op.create_table(
        "hr_attendance_rule",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rule_code", sa.String(50), nullable=False),
        sa.Column("rule_name", sa.String(255), nullable=False),
        sa.Column("grace_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("late_mark_after_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("half_day_hours", sa.Numeric(5, 2), nullable=False, server_default="4.00"),
        sa.Column("full_day_hours", sa.Numeric(5, 2), nullable=False, server_default="8.00"),
        sa.Column("early_leave_half_day_minutes", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("overtime_allowed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("geofence_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("miss_punch_window_hours", sa.Integer(), nullable=False, server_default="48"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("company_id", "rule_code", name="uk_hr_att_rule_company_code"),
        sa.CheckConstraint("status IN ('active','inactive')", name="ck_hr_att_rule_status"),
        schema="hr",
    )
    op.create_index("ix_hr_att_rule_status", "hr_attendance_rule", ["status"], schema="hr")
    op.create_index("ix_hr_att_rule_branch", "hr_attendance_rule", ["branch_id"], schema="hr")


def downgrade() -> None:
    op.drop_table("hr_attendance_rule", schema="hr")
    op.drop_table("hr_weekly_off_policy", schema="hr")
