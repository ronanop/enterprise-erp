"""Create helpdesk schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0289_create_helpdesk_schema"
down_revision: str | None = "0288_seed_service_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS helpdesk")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS helpdesk CASCADE")
