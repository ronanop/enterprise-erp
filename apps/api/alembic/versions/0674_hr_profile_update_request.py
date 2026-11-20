"""Create hr_profile_update_request for ESS → HR detail updates."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0674_hr_profile_update_request"
down_revision: str | Sequence[str] | None = "0673_hr_employee_profile_photo"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hr_profile_update_request",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="submitted"),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_notes", sa.Text(), nullable=True),
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
            "is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(
            ["employee_id"], ["master.master_employee.id"], ondelete="RESTRICT"
        ),
        sa.CheckConstraint(
            "status IN ('submitted','approved','rejected','cancelled')",
            name="ck_hr_profile_upd_status",
        ),
        schema="hr",
    )
    op.create_index(
        "ix_hr_profile_upd_emp",
        "hr_profile_update_request",
        ["employee_id"],
        schema="hr",
    )
    op.create_index(
        "ix_hr_profile_upd_status",
        "hr_profile_update_request",
        ["status"],
        schema="hr",
    )
    op.create_index(
        "ix_hr_profile_upd_company",
        "hr_profile_update_request",
        ["company_id"],
        schema="hr",
    )
    op.create_index(
        "ix_hr_profile_upd_branch",
        "hr_profile_update_request",
        ["branch_id"],
        schema="hr",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_hr_profile_upd_branch",
        table_name="hr_profile_update_request",
        schema="hr",
    )
    op.drop_index(
        "ix_hr_profile_upd_company",
        table_name="hr_profile_update_request",
        schema="hr",
    )
    op.drop_index(
        "ix_hr_profile_upd_status",
        table_name="hr_profile_update_request",
        schema="hr",
    )
    op.drop_index(
        "ix_hr_profile_upd_emp",
        table_name="hr_profile_update_request",
        schema="hr",
    )
    op.drop_table("hr_profile_update_request", schema="hr")
