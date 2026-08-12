"""Video editor section approval and final draft workflow."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0493_mkt_video_section"
down_revision: str | None = "0492_mkt_linkedin_final_draft"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mkt_content_item",
        sa.Column("video_head_sections", JSONB, nullable=True),
        schema="marketing",
    )
    op.add_column(
        "mkt_content_item",
        sa.Column("video_final_draft", JSONB, nullable=True),
        schema="marketing",
    )


def downgrade() -> None:
    op.drop_column("mkt_content_item", "video_final_draft", schema="marketing")
    op.drop_column("mkt_content_item", "video_head_sections", schema="marketing")
