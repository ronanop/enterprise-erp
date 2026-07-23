"""Add company account + customer name to crm_followup."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0450_crm_followup_company"
down_revision: str | None = "0449_crm_quote_snapshot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_followup",
        sa.Column("company_account_id", sa.UUID(), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_followup",
        sa.Column("customer_name", sa.String(length=255), nullable=True),
        schema="crm",
    )
    op.create_foreign_key(
        "fk_crm_followup_company_account",
        "crm_followup",
        "crm_company",
        ["company_account_id"],
        ["id"],
        source_schema="crm",
        referent_schema="crm",
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_crm_followup_company_account_id",
        "crm_followup",
        ["company_account_id"],
        unique=False,
        schema="crm",
    )


def downgrade() -> None:
    op.drop_index("ix_crm_followup_company_account_id", table_name="crm_followup", schema="crm")
    op.drop_constraint(
        "fk_crm_followup_company_account",
        "crm_followup",
        schema="crm",
        type_="foreignkey",
    )
    op.drop_column("crm_followup", "customer_name", schema="crm")
    op.drop_column("crm_followup", "company_account_id", schema="crm")
