"""Add structured distributor contact fields to CRM leads."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0446_crm_lead_contacts"
down_revision: str | None = "0445_crm_sales_process"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_lead",
        sa.Column("distributor_contact_person", sa.String(length=150), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_lead",
        sa.Column("distributor_contact_email", sa.String(length=255), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_lead",
        sa.Column("distributor_department", sa.String(length=150), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    op.drop_column("crm_lead", "distributor_department", schema="crm")
    op.drop_column("crm_lead", "distributor_contact_email", schema="crm")
    op.drop_column("crm_lead", "distributor_contact_person", schema="crm")
