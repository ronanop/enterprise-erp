"""Widen crm_lead/crm_opportunity product_type for multi-select values."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0616_crm_product_type_widen"
down_revision: str | None = "0615_crm_lead_source_company_align"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "crm_lead",
        "product_type",
        existing_type=sa.String(length=30),
        type_=sa.Text(),
        existing_nullable=True,
        schema="crm",
    )
    op.alter_column(
        "crm_opportunity",
        "product_type",
        existing_type=sa.String(length=30),
        type_=sa.Text(),
        existing_nullable=True,
        schema="crm",
    )


def downgrade() -> None:
    op.alter_column(
        "crm_opportunity",
        "product_type",
        existing_type=sa.Text(),
        type_=sa.String(length=30),
        existing_nullable=True,
        schema="crm",
    )
    op.alter_column(
        "crm_lead",
        "product_type",
        existing_type=sa.Text(),
        type_=sa.String(length=30),
        existing_nullable=True,
        schema="crm",
    )
