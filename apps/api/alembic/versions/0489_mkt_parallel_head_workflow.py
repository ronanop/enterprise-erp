"""Parallel per-role head verification workflow fields."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0489_mkt_parallel_head_workflow"
down_revision: str | None = "0488_mkt_verification_workflow"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mkt_content_verification",
        sa.Column("requested_by_user_id", sa.UUID(), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_content_verification",
        sa.Column("posting_planned_at", sa.DateTime(timezone=True), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_content_verification",
        sa.Column("posting_timeline_notes", sa.Text(), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_content_verification",
        sa.Column("posting_confirmed", sa.Boolean(), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_content_verification",
        sa.Column("sent_to_publisher_at", sa.DateTime(timezone=True), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_content_verification",
        sa.Column("publisher_upload_status", sa.String(30), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_content_verification",
        sa.Column("publisher_upload_notes", sa.Text(), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_content_verification",
        sa.Column("publisher_reported_at", sa.DateTime(timezone=True), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_verification_item",
        sa.Column("submitted_to_head_at", sa.DateTime(timezone=True), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_verification_item",
        sa.Column("submitted_by_user_id", sa.UUID(), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_verification_item",
        sa.Column("reviewed_by_user_id", sa.UUID(), nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_verification_item",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        schema="marketing",
    )


def downgrade() -> None:
    op.drop_column("mkt_verification_item", "reviewed_at", schema="marketing")
    op.drop_column("mkt_verification_item", "reviewed_by_user_id", schema="marketing")
    op.drop_column("mkt_verification_item", "submitted_by_user_id", schema="marketing")
    op.drop_column("mkt_verification_item", "submitted_to_head_at", schema="marketing")
    op.drop_column("mkt_content_verification", "publisher_reported_at", schema="marketing")
    op.drop_column("mkt_content_verification", "publisher_upload_notes", schema="marketing")
    op.drop_column("mkt_content_verification", "publisher_upload_status", schema="marketing")
    op.drop_column("mkt_content_verification", "sent_to_publisher_at", schema="marketing")
    op.drop_column("mkt_content_verification", "posting_confirmed", schema="marketing")
    op.drop_column("mkt_content_verification", "posting_timeline_notes", schema="marketing")
    op.drop_column("mkt_content_verification", "posting_planned_at", schema="marketing")
    op.drop_column("mkt_content_verification", "requested_by_user_id", schema="marketing")
