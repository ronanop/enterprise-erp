"""Create marketing schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0515_create_marketing_schema"
down_revision: str | Sequence[str] | None = "0514_proc_ovf_stock_allocation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS marketing")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS marketing CASCADE")
