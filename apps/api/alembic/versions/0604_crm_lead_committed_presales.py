"""Add committed_amount and presales_owner_id to crm_lead."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0604_crm_lead_committed_presales"
down_revision: str | Sequence[str] | None = "0603_crm_saved_reports"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_lead",
        sa.Column("committed_amount", sa.Numeric(18, 4), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_lead",
        sa.Column(
            "presales_owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("master.master_employee.id", ondelete="SET NULL"),
            nullable=True,
        ),
        schema="crm",
    )
    op.create_index(
        "ix_crm_lead_presales_owner_id",
        "crm_lead",
        ["presales_owner_id"],
        unique=False,
        schema="crm",
    )


def downgrade() -> None:
    op.drop_index("ix_crm_lead_presales_owner_id", table_name="crm_lead", schema="crm")
    op.drop_column("crm_lead", "presales_owner_id", schema="crm")
    op.drop_column("crm_lead", "committed_amount", schema="crm")
