"""Add per-document remarks to CRM attachments."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0500_crm_attachment_remarks"
down_revision: str | Sequence[str] | None = "0499_proc_inventory_stock_qty"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_attachment",
        sa.Column("remarks", sa.Text(), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    op.drop_column("crm_attachment", "remarks", schema="crm")
