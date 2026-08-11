"""Management groups (employment type policy) + employment link."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import (  # noqa: E402
    add_column_if_missing,
    create_fk_if_missing,
    create_index_if_missing,
)

revision: str = "0490_hr_management_group"
down_revision: str | None = "0472_vascan_checkbox_date"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hr_management_group",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("group_code", sa.String(50), nullable=False),
        sa.Column("group_name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("employment_type", sa.String(30), nullable=False, server_default="permanent"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("default_shift_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("default_shift_rotation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("default_attendance_rule_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("default_holiday_calendar_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("default_weekly_off_policy_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "feature_toggles_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["default_shift_id"], ["hr.hr_shift.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["default_shift_rotation_id"], ["hr.hr_shift_rotation.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["default_attendance_rule_id"], ["hr.hr_attendance_rule.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["default_holiday_calendar_id"], ["hr.hr_holiday_calendar.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["default_weekly_off_policy_id"], ["hr.hr_weekly_off_policy.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("company_id", "group_code", name="uk_hr_mgmt_group_company_code"),
        sa.CheckConstraint("status IN ('active','inactive')", name="ck_hr_mgmt_group_status"),
        schema="hr",
    )
    op.create_index("ix_hr_management_group_company", "hr_management_group", ["company_id"], schema="hr")
    op.create_index("ix_hr_management_group_status", "hr_management_group", ["status"], schema="hr")

    add_column_if_missing(
        "hr_employment",
        sa.Column("management_group_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="hr",
    )
    create_fk_if_missing(
        "fk_hr_employment_mgmt_group",
        "hr_employment",
        "hr_management_group",
        ["management_group_id"],
        ["id"],
        source_schema="hr",
        referent_schema="hr",
        ondelete="RESTRICT",
    )
    create_index_if_missing(
        "ix_hr_employment_management_group",
        "hr_employment",
        ["management_group_id"],
        schema="hr",
    )


def downgrade() -> None:
    op.drop_index("ix_hr_employment_management_group", table_name="hr_employment", schema="hr")
    op.drop_constraint("fk_hr_employment_mgmt_group", "hr_employment", schema="hr", type_="foreignkey")
    op.drop_column("hr_employment", "management_group_id", schema="hr")
    op.drop_table("hr_management_group", schema="hr")
