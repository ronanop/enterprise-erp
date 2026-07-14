"""Create quality schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0115_create_quality_schema"
down_revision: str | None = "0114_seed_mfg_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS quality")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS quality CASCADE")
