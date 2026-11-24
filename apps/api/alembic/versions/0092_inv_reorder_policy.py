"""Create InvReorderPolicy table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0092_inv_reorder_policy"
down_revision: str | None = "0091_inv_valuation_layer"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.inventory.models.reorder_policy import InvReorderPolicy  # noqa: F401
    except ModuleNotFoundError:
        return
    InvReorderPolicy.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.inventory.models.reorder_policy import InvReorderPolicy  # noqa: F401
    except ModuleNotFoundError:
        return
    InvReorderPolicy.__table__.drop(bind=op.get_bind(), checkfirst=True)
