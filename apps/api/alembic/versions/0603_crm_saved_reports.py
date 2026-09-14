"""Create CRM saved custom reports table."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0603_crm_saved_reports"
down_revision: str | Sequence[str] | None = "0602_mkt_brand_kit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "crm_saved_report",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("report_code", sa.String(length=50), nullable=False),
        sa.Column("report_name", sa.String(length=255), nullable=False),
        sa.Column("primary_module", sa.String(length=50), nullable=False),
        sa.Column("folder_name", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("definition_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("foundation.sec_tenant.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organization.org_company.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.UniqueConstraint("company_id", "report_code", name="uk_crm_saved_report_company_code"),
        schema="crm",
    )
    op.create_index(
        "ix_crm_saved_report_tenant_id",
        "crm_saved_report",
        ["tenant_id"],
        schema="crm",
    )
    op.create_index(
        "ix_crm_saved_report_primary_module",
        "crm_saved_report",
        ["primary_module"],
        schema="crm",
    )
    op.create_index(
        "ix_crm_saved_report_owner_user_id",
        "crm_saved_report",
        ["owner_user_id"],
        schema="crm",
    )


def downgrade() -> None:
    op.drop_index("ix_crm_saved_report_owner_user_id", table_name="crm_saved_report", schema="crm")
    op.drop_index("ix_crm_saved_report_primary_module", table_name="crm_saved_report", schema="crm")
    op.drop_index("ix_crm_saved_report_tenant_id", table_name="crm_saved_report", schema="crm")
    op.drop_table("crm_saved_report", schema="crm")
