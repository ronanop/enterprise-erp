"""Lead BOQ/SOW requirement and attachment flags for pre-convert gating."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0623_crm_lead_boq_sow_flags"
down_revision: str | Sequence[str] | None = "0622_crm_approval_step_owner"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_lead",
        sa.Column("requires_boq", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        schema="crm",
    )
    op.add_column(
        "crm_lead",
        sa.Column("requires_sow", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        schema="crm",
    )
    op.add_column(
        "crm_lead",
        sa.Column("boq_attached", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        schema="crm",
    )
    op.add_column(
        "crm_lead",
        sa.Column("sow_attached", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        schema="crm",
    )


def downgrade() -> None:
    op.drop_column("crm_lead", "sow_attached", schema="crm")
    op.drop_column("crm_lead", "boq_attached", schema="crm")
    op.drop_column("crm_lead", "requires_sow", schema="crm")
    op.drop_column("crm_lead", "requires_boq", schema="crm")
