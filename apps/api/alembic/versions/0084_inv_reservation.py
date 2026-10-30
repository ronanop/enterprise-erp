"""Create InvReservation table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0084_inv_reservation"
down_revision: str | None = "0083_inv_stock_ledger"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.inventory.models.reservation import InvReservation  # noqa: F401
    except ModuleNotFoundError:
        return
    InvReservation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.inventory.models.reservation import InvReservation  # noqa: F401
    except ModuleNotFoundError:
        return
    InvReservation.__table__.drop(bind=op.get_bind(), checkfirst=True)
