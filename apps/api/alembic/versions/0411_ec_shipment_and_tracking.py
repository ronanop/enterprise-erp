"""Create ec_shipment and ec_shipping_tracking tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0411_ec_shipment_and_tracking"
down_revision: str | None = "0410_ec_payment_transaction"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.shipment import EcShipment  # noqa: F401
    except ModuleNotFoundError:
        return
    EcShipment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.shipment import EcShipment  # noqa: F401
    except ModuleNotFoundError:
        return
    EcShipment.__table__.drop(bind=op.get_bind(), checkfirst=True)
