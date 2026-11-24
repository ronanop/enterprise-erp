"""Create InvBatch table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0080_inv_batch"
down_revision: str | None = "0079_inv_bin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.inventory.models.batch import InvBatch  # noqa: F401
    except ModuleNotFoundError:
        return
    InvBatch.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.inventory.models.batch import InvBatch  # noqa: F401
    except ModuleNotFoundError:
        return
    InvBatch.__table__.drop(bind=op.get_bind(), checkfirst=True)
