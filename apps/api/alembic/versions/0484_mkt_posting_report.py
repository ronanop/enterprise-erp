"""Add posting report columns for creator → head confirmation."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0484_mkt_posting_report"
down_revision: str | None = "0483_mkt_demo_media_perm"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mkt_content_item",
        sa.Column("posting_report_status", sa.String(20), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_content_item",
        sa.Column("posting_report_notes", sa.Text(), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_content_item",
        sa.Column("posting_reported_at", sa.DateTime(timezone=True), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_content_item",
        sa.Column("posting_reported_by_id", sa.UUID(), nullable=True),
        schema="marketing",
    )
    op.execute(
        """
        UPDATE marketing.mkt_content_item
        SET posting_report_status = 'pending'
        WHERE status IN ('approved', 'scheduled')
          AND posting_report_status IS NULL
          AND is_deleted = false
        """
    )


def downgrade() -> None:
    op.drop_column("mkt_content_item", "posting_reported_by_id", schema="marketing")
    op.drop_column("mkt_content_item", "posting_reported_at", schema="marketing")
    op.drop_column("mkt_content_item", "posting_report_notes", schema="marketing")
    op.drop_column("mkt_content_item", "posting_report_status", schema="marketing")
