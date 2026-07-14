"""Create crm schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0136_create_crm_schema"
down_revision: str | None = "0135_seed_qm_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS crm")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS crm CASCADE")
