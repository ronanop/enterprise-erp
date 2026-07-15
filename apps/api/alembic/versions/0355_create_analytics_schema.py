"""Create analytics schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0355_create_analytics_schema"
down_revision: str | None = "0354_seed_grc_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS analytics")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS analytics CASCADE")
