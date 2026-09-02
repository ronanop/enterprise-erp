"""Add quote AMC/warranty and structured billing/shipping address fields."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0586_crm_quote_address_amc"
down_revision: str | None = "0585_hr_member_workspace_reads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_quote",
        sa.Column("amc_warranty", sa.String(length=10), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_quote",
        sa.Column("amc_start_date", sa.Date(), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_quote",
        sa.Column("amc_end_date", sa.Date(), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_quote",
        sa.Column("billing_street", sa.String(length=255), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_quote",
        sa.Column("billing_city", sa.String(length=100), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_quote",
        sa.Column("billing_state", sa.String(length=100), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_quote",
        sa.Column("billing_zip", sa.String(length=20), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_quote",
        sa.Column("shipping_street", sa.String(length=255), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_quote",
        sa.Column("shipping_city", sa.String(length=100), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_quote",
        sa.Column("shipping_state", sa.String(length=100), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_quote",
        sa.Column("shipping_zip", sa.String(length=20), nullable=True),
        schema="crm",
    )
    op.create_check_constraint(
        "ck_crm_quote_amc_warranty",
        "crm_quote",
        "amc_warranty IS NULL OR amc_warranty IN ('none','yes','no')",
        schema="crm",
    )


def downgrade() -> None:
    op.drop_constraint("ck_crm_quote_amc_warranty", "crm_quote", schema="crm", type_="check")
    for column in (
        "shipping_zip",
        "shipping_state",
        "shipping_city",
        "shipping_street",
        "billing_zip",
        "billing_state",
        "billing_city",
        "billing_street",
        "amc_end_date",
        "amc_start_date",
        "amc_warranty",
    ):
        op.drop_column("crm_quote", column, schema="crm")
