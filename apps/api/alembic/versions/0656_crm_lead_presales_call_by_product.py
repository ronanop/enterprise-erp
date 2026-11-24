"""Add per-product-type PreSales call alignment JSON on CRM leads."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0656_crm_lead_presales_call_by_product"
down_revision: str | Sequence[str] | None = "0655_crm_lead_sale_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_lead",
        sa.Column("presales_call_by_product", sa.Text(), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    op.drop_column("crm_lead", "presales_call_by_product", schema="crm")
