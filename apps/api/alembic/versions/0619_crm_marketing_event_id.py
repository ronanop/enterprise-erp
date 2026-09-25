"""Add marketing_event_id soft links for Event source on company/lead."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0619_crm_marketing_event_id"
down_revision: str | None = "0618_crm_lead_partner_names"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_company",
        sa.Column("marketing_event_id", sa.UUID(), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_lead",
        sa.Column("marketing_event_id", sa.UUID(), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    op.drop_column("crm_lead", "marketing_event_id", schema="crm")
    op.drop_column("crm_company", "marketing_event_id", schema="crm")
