"""Content-based LinkedIn head section approval (replaces checklist for LinkedIn handler)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0491_mkt_linkedin_sections"
down_revision: str | None = "0490_mkt_ver_soft_del"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mkt_content_item",
        sa.Column("linkedin_head_sections", JSONB, nullable=True),
        schema="marketing",
    )


def downgrade() -> None:
    op.drop_column("mkt_content_item", "linkedin_head_sections", schema="marketing")
