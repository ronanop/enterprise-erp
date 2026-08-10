"""Add campaign submit / head review workflow columns."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0485_mkt_campaign_review"
down_revision: str | None = "0484_mkt_posting_report"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mkt_campaign",
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_campaign",
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_campaign",
        sa.Column("approved_by_id", sa.UUID(), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_campaign",
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        schema="marketing",
    )


def downgrade() -> None:
    op.drop_column("mkt_campaign", "rejection_reason", schema="marketing")
    op.drop_column("mkt_campaign", "approved_by_id", schema="marketing")
    op.drop_column("mkt_campaign", "approved_at", schema="marketing")
    op.drop_column("mkt_campaign", "submitted_at", schema="marketing")
