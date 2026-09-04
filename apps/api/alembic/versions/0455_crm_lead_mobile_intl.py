"""Widen CRM lead mobile for international numbers."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0455_crm_lead_mobile_intl"
down_revision: str | None = "0453_crm_attachment_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "crm_lead",
        "mobile",
        existing_type=sa.String(length=30),
        type_=sa.String(length=50),
        existing_nullable=False,
        schema="crm",
    )


def downgrade() -> None:
    op.alter_column(
        "crm_lead",
        "mobile",
        existing_type=sa.String(length=50),
        type_=sa.String(length=30),
        existing_nullable=False,
        schema="crm",
    )
