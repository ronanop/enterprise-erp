"""Create InvCycleCountLine table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0090_inv_cycle_count_line"
down_revision: str | None = "0089_inv_cycle_count_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.inventory.models.cycle_count import InvCycleCountLine  # noqa: F401
    except ModuleNotFoundError:
        return
    InvCycleCountLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.inventory.models.cycle_count import InvCycleCountLine  # noqa: F401
    except ModuleNotFoundError:
        return
    InvCycleCountLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
