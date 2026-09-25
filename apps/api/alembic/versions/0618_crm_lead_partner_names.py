"""Add crm_lead.partner_names for Multi-Tier lead source."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0618_crm_lead_partner_names"
down_revision: str | None = "0617_merge_ast_crm_heads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_lead",
        sa.Column("partner_names", sa.Text(), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    op.drop_column("crm_lead", "partner_names", schema="crm")
