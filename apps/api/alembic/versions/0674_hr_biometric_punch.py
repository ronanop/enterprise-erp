"""Create hr_biometric_punch for multi-device punch history."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from helpers import index_exists, table_exists

revision: str = "0674_hr_biometric_punch"
down_revision: str | Sequence[str] | None = "0673_org_company_emp_code_prefix"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SCHEMA = "hr"
_TABLE = "hr_biometric_punch"


def upgrade() -> None:
    bind = op.get_bind()
    if not table_exists(bind, _TABLE, schema=_SCHEMA):
        op.create_table(
            _TABLE,
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("device_code", sa.String(50), nullable=False),
            sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("employee_code_raw", sa.String(50), nullable=False),
            sa.Column("punched_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("attendance_date", sa.Date(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column(
                "is_deleted",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.ForeignKeyConstraint(
                ["tenant_id"],
                ["foundation.sec_tenant.id"],
                ondelete="RESTRICT",
            ),
            sa.ForeignKeyConstraint(
                ["company_id"],
                ["organization.org_company.id"],
                ondelete="RESTRICT",
            ),
            sa.ForeignKeyConstraint(
                ["branch_id"],
                ["organization.org_branch.id"],
                ondelete="RESTRICT",
            ),
            sa.ForeignKeyConstraint(
                ["device_id"],
                ["hr.hr_biometric_device.id"],
                ondelete="SET NULL",
            ),
            sa.ForeignKeyConstraint(
                ["employee_id"],
                ["master.master_employee.id"],
                ondelete="RESTRICT",
            ),
            schema=_SCHEMA,
        )

    indexes = [
        ("ix_hr_biometric_punch_tenant_id", ["tenant_id"]),
        ("ix_hr_biometric_punch_company_id", ["company_id"]),
        ("ix_hr_biometric_punch_branch_id", ["branch_id"]),
        ("ix_hr_biometric_punch_device_id", ["device_id"]),
        ("ix_hr_biometric_punch_employee_id", ["employee_id"]),
        ("ix_hr_biometric_punch_punched_at", ["punched_at"]),
        ("ix_hr_biometric_punch_attendance_date", ["attendance_date"]),
        ("ix_hr_bio_punch_emp_date", ["employee_id", "attendance_date"]),
        ("ix_hr_bio_punch_device_date", ["device_id", "attendance_date"]),
    ]
    for name, cols in indexes:
        if not index_exists(bind, _TABLE, name, schema=_SCHEMA):
            op.create_index(name, _TABLE, cols, schema=_SCHEMA)

    if not index_exists(bind, _TABLE, "uk_hr_bio_punch_live", schema=_SCHEMA):
        op.create_index(
            "uk_hr_bio_punch_live",
            _TABLE,
            ["company_id", "device_code", "employee_code_raw", "punched_at"],
            unique=True,
            schema=_SCHEMA,
            postgresql_where=sa.text("is_deleted = false"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if table_exists(bind, _TABLE, schema=_SCHEMA):
        op.drop_table(_TABLE, schema=_SCHEMA)
