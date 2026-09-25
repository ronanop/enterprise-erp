"""Widen crm_lead.deal_type for Hardware/Service sourcing channel JSON."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0620_crm_lead_deal_type_widen"
down_revision: str | None = "0619_crm_marketing_event_id"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "crm_lead",
        "deal_type",
        existing_type=sa.String(length=50),
        type_=sa.Text(),
        existing_nullable=True,
        schema="crm",
    )


def downgrade() -> None:
    op.alter_column(
        "crm_lead",
        "deal_type",
        existing_type=sa.Text(),
        type_=sa.String(length=50),
        existing_nullable=True,
        schema="crm",
    )
