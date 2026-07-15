"""Create document schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0311_create_document_schema"
down_revision: str | None = "0310_seed_helpdesk_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS document")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS document CASCADE")
