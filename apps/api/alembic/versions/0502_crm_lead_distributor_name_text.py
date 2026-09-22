"""Expand lead distributor name field for multi-select values."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0502_crm_lead_distributor_name_text"
down_revision: str | None = "0501_crm_lead_oem_name_text"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "crm_lead",
        "distributor_name",
        existing_type=sa.String(length=150),
        type_=sa.Text(),
        existing_nullable=True,
        schema="crm",
    )


def downgrade() -> None:
    op.alter_column(
        "crm_lead",
        "distributor_name",
        existing_type=sa.Text(),
        type_=sa.String(length=150),
        existing_nullable=True,
        schema="crm",
    )
