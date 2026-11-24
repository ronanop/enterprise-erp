"""Add sub_product_category on CRM quote lines."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0657_crm_quote_line_sub_product_category"
down_revision: str | Sequence[str] | None = "0656_crm_lead_presales_call_by_product"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_quote_line",
        sa.Column("sub_product_category", sa.String(length=150), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    op.drop_column("crm_quote_line", "sub_product_category", schema="crm")
