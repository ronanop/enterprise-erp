"""V2 finish: device tokens, biometric devices, Comp Off requests."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0486_hr_v2_finish"
down_revision: str | None = "0485_hr_kpi_okr"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ntf_device_token",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token", sa.String(512), nullable=False),
        sa.Column("platform", sa.String(30), nullable=False, server_default="web"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.UniqueConstraint("tenant_id", "user_id", "token", name="uk_ntf_device_token"),
        sa.CheckConstraint("platform IN ('web','android','ios')", name="ck_ntf_device_platform"),
        schema="foundation",
    )
    op.create_index("ix_ntf_device_user", "ntf_device_token", ["user_id"], schema="foundation")

    op.create_table(
        "hr_biometric_device",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_code", sa.String(50), nullable=False),
        sa.Column("device_name", sa.String(255), nullable=False),
        sa.Column("location_text", sa.String(255), nullable=True),
        sa.Column("api_key_hash", sa.String(128), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("company_id", "device_code", name="uk_hr_bio_device_code"),
        sa.CheckConstraint("status IN ('active','inactive')", name="ck_hr_bio_device_status"),
        schema="hr",
    )

    op.create_table(
        "hr_compoff_request",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("earned_date", sa.Date(), nullable=False),
        sa.Column("extra_hours", sa.Numeric(6, 2), nullable=False),
        sa.Column("requested_days", sa.Numeric(5, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("manager_approver_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("hr_approver_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["employee_id"], ["master.master_employee.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "status IN ('draft','submitted','manager_approved','approved','rejected','cancelled')",
            name="ck_hr_compoff_req_status",
        ),
        schema="hr",
    )
    op.create_index("ix_hr_compoff_req_emp", "hr_compoff_request", ["employee_id"], schema="hr")
    op.create_index("ix_hr_compoff_req_status", "hr_compoff_request", ["status"], schema="hr")


def downgrade() -> None:
    op.drop_table("hr_compoff_request", schema="hr")
    op.drop_table("hr_biometric_device", schema="hr")
    op.drop_table("ntf_device_token", schema="foundation")
