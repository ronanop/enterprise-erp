"""Brand kit payload on marketing brand voice."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0602_mkt_brand_kit"
down_revision: str | Sequence[str] | None = "0590_mkt_social_inbox"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mkt_brand_voice",
        sa.Column("brand_kit", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="marketing",
    )


def downgrade() -> None:
    op.drop_column("mkt_brand_voice", "brand_kit", schema="marketing")
