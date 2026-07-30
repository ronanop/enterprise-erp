"""Create hr_roster_entry for shift roster scheduling."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0448_hr_roster_and_ess"
down_revision: str | None = "0447_hr_enterprise_lifecycle_kyc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hr_roster_entry",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("shift_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("roster_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(
            ["employee_id"], ["master.master_employee.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["shift_id"], ["hr.hr_shift.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"
        ),
        sa.UniqueConstraint(
            "company_id", "employee_id", "roster_date", name="uk_hr_roster_emp_date"
        ),
        sa.CheckConstraint(
            "status IN ('draft','published','cancelled')",
            name="ck_hr_roster_status",
        ),
        schema="hr",
    )
    op.create_index("ix_hr_roster_branch", "hr_roster_entry", ["branch_id"], schema="hr")
    op.create_index("ix_hr_roster_employee", "hr_roster_entry", ["employee_id"], schema="hr")
    op.create_index("ix_hr_roster_shift", "hr_roster_entry", ["shift_id"], schema="hr")
    op.create_index("ix_hr_roster_date", "hr_roster_entry", ["roster_date"], schema="hr")
    op.create_index("ix_hr_roster_status", "hr_roster_entry", ["status"], schema="hr")
    op.create_index("ix_hr_roster_company", "hr_roster_entry", ["company_id"], schema="hr")
    op.create_index("ix_hr_roster_tenant", "hr_roster_entry", ["tenant_id"], schema="hr")


def downgrade() -> None:
    op.drop_table("hr_roster_entry", schema="hr")
