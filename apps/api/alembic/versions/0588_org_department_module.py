"""Add organization.org_department_module for department↔ERP module mapping."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0588_org_department_module"
down_revision: str | Sequence[str] | None = "0587_grant_proc_master_vendor_reads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "org_department_module",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("module_key", sa.String(length=50), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["organization.org_department.id"],
            name="fk_org_department_module_department",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "department_id",
            "module_key",
            name="uk_org_department_module",
        ),
        schema="organization",
    )
    op.create_index(
        "ix_org_department_module_tenant_id",
        "org_department_module",
        ["tenant_id"],
        schema="organization",
    )
    op.create_index(
        "ix_org_department_module_department_id",
        "org_department_module",
        ["department_id"],
        schema="organization",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_org_department_module_department_id",
        table_name="org_department_module",
        schema="organization",
    )
    op.drop_index(
        "ix_org_department_module_tenant_id",
        table_name="org_department_module",
        schema="organization",
    )
    op.drop_table("org_department_module", schema="organization")
