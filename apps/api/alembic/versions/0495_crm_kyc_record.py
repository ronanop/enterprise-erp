"""CRM KYC record (Zoho-style company KYC profile)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0495_crm_kyc_record"
down_revision: str | None = "0494_crm_selling_entity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "crm_kyc_record",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("kyc_code", sa.String(50), nullable=False),
        sa.Column(
            "company_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("crm.crm_company.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "owner_employee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "quote_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("crm.crm_quote.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "form_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("company_id", "kyc_code", name="uk_crm_kyc_company_code"),
        schema="crm",
    )
    op.create_index("ix_crm_kyc_record_company_account", "crm_kyc_record", ["company_account_id"], schema="crm")
    op.create_index("ix_crm_kyc_record_owner", "crm_kyc_record", ["owner_employee_id"], schema="crm")


def downgrade() -> None:
    op.drop_table("crm_kyc_record", schema="crm")
