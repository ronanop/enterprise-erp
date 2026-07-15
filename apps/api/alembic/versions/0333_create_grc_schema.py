"""Create grc schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0333_create_grc_schema"
down_revision: str | None = "0332_seed_document_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS grc")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS grc CASCADE")
