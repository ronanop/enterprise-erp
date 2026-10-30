"""Create EcCartItem table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0406_ec_cart_item"
down_revision: str | None = "0405_ec_customer_cart"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.cart_item import EcCartItem  # noqa: F401
    except ModuleNotFoundError:
        return
    EcCartItem.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.cart_item import EcCartItem  # noqa: F401
    except ModuleNotFoundError:
        return
    EcCartItem.__table__.drop(bind=op.get_bind(), checkfirst=True)
