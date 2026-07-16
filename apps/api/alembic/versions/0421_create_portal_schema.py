"""Create portal schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0421_create_portal_schema"
down_revision: str | None = "0420_seed_ecommerce_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS portal")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS portal CASCADE")
