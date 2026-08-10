"""LinkedIn handler final draft (poster + content) before publisher."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0492_mkt_linkedin_final_draft"
down_revision: str | None = "0491_mkt_linkedin_sections"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mkt_content_item",
        sa.Column("linkedin_final_draft", JSONB, nullable=True),
        schema="marketing",
    )


def downgrade() -> None:
    op.drop_column("mkt_content_item", "linkedin_final_draft", schema="marketing")
