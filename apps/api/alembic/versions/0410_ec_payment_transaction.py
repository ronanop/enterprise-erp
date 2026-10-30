"""Create EcPaymentTransaction table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0410_ec_payment_transaction"
down_revision: str | None = "0409_ec_payment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.payment_transaction import EcPaymentTransaction  # noqa: F401
    except ModuleNotFoundError:
        return
    EcPaymentTransaction.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.payment_transaction import EcPaymentTransaction  # noqa: F401
    except ModuleNotFoundError:
        return
    EcPaymentTransaction.__table__.drop(bind=op.get_bind(), checkfirst=True)
