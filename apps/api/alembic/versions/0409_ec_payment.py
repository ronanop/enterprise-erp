"""Create EcPayment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0409_ec_payment"
down_revision: str | None = "0408_ec_order_item"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.payment import EcPayment  # noqa: F401
    except ModuleNotFoundError:
        return
    EcPayment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.payment import EcPayment  # noqa: F401
    except ModuleNotFoundError:
        return
    EcPayment.__table__.drop(bind=op.get_bind(), checkfirst=True)
