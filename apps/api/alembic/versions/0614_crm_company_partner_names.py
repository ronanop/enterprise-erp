"""Add crm_company.partner_names for Multi-Tier source."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0614_crm_company_partner_names"
down_revision: str | None = "0613_audit_operation_widen"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_company",
        sa.Column("partner_names", sa.Text(), nullable=True),
        schema="crm",
    )
    # Rename legacy source value for consistency with the Multi-Tier UI label.
    op.execute(
        sa.text(
            "UPDATE crm.crm_company SET source = 'multi_tier' "
            "WHERE source = 'partner' AND coalesce(is_deleted, false) = false"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE crm.crm_company SET source = 'partner' "
            "WHERE source = 'multi_tier' AND coalesce(is_deleted, false) = false"
        )
    )
    op.drop_column("crm_company", "partner_names", schema="crm")
