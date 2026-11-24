"""Add sale_type (sell_through / sell_to) on CRM leads."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0655_crm_lead_sale_type"
down_revision: str | Sequence[str] | None = "0654_crm_attachment_ovf_po_pdf_category"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_lead",
        sa.Column("sale_type", sa.String(length=30), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    op.drop_column("crm_lead", "sale_type", schema="crm")
