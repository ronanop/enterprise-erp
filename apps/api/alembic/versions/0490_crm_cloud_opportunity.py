"""CRM cloud opportunity fields and contract attachment category."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0490_crm_cloud_opportunity"
down_revision: str | None = "0492_org_branch_head"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for col in (
        sa.Column("cloud_blueprint_variant", sa.String(30), nullable=True),
        sa.Column("product_type", sa.String(30), nullable=True),
        sa.Column("cloud_sub_product", sa.String(100), nullable=True),
        sa.Column("customer_mrr", sa.Numeric(18, 4), nullable=True),
        sa.Column("customer_arr", sa.Numeric(18, 4), nullable=True),
        sa.Column("customer_discount_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("distributor_discount_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("profitability_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("distributor_discount_locked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("assessment_type", sa.String(100), nullable=True),
        sa.Column("migration_credit_phase1", sa.Numeric(18, 4), nullable=True),
        sa.Column("migration_credit_phase2", sa.Numeric(18, 4), nullable=True),
        sa.Column("migration_credit_phase3", sa.Numeric(18, 4), nullable=True),
        sa.Column("contract_attached", sa.Boolean(), nullable=False, server_default="false"),
    ):
        add_column_if_missing("crm_opportunity", col, schema="crm")

    op.execute(
        "ALTER TABLE crm.crm_attachment DROP CONSTRAINT IF EXISTS ck_crm_attachment_category"
    )
    op.execute(
        """
        ALTER TABLE crm.crm_attachment ADD CONSTRAINT ck_crm_attachment_category
        CHECK (category IN (
            'boq','sow','oem_quote','customer_po','vendor_quote','contract','other'
        ))
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE crm.crm_attachment DROP CONSTRAINT IF EXISTS ck_crm_attachment_category"
    )
    op.execute(
        """
        ALTER TABLE crm.crm_attachment ADD CONSTRAINT ck_crm_attachment_category
        CHECK (category IN (
            'boq','sow','oem_quote','customer_po','vendor_quote','other'
        ))
        """
    )
    for name in (
        "contract_attached",
        "migration_credit_phase3",
        "migration_credit_phase2",
        "migration_credit_phase1",
        "assessment_type",
        "distributor_discount_locked",
        "profitability_percent",
        "distributor_discount_percent",
        "customer_discount_percent",
        "customer_arr",
        "customer_mrr",
        "cloud_sub_product",
        "product_type",
        "cloud_blueprint_variant",
    ):
        op.drop_column("crm_opportunity", name, schema="crm")
