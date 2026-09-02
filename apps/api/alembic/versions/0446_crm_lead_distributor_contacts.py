"""Add structured distributor contact fields to CRM leads."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0446_crm_lead_contacts"
down_revision: str | None = "0445_crm_sales_process"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_lead",
        sa.Column("distributor_contact_person", sa.String(length=150), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_lead",
        sa.Column("distributor_contact_email", sa.String(length=255), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_lead",
        sa.Column("distributor_department", sa.String(length=150), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("crm_lead", "distributor_department", schema="crm")
    op.drop_column("crm_lead", "distributor_contact_email", schema="crm")
    op.drop_column("crm_lead", "distributor_contact_person", schema="crm")
