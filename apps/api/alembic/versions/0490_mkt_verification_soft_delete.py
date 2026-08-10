"""Add missing soft-delete columns to marketing verification tables."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0490_mkt_ver_soft_del"
down_revision: str | None = "0489_mkt_parallel_head_workflow"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("mkt_content_verification", "mkt_verification_item")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            schema="marketing",
        )
        op.add_column(
            table,
            sa.Column("deleted_by", sa.UUID(), nullable=True),
            schema="marketing",
        )


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_column(table, "deleted_by", schema="marketing")
        op.drop_column(table, "deleted_at", schema="marketing")
