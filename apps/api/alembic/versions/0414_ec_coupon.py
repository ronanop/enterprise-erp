"""Create EcCoupon table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0414_ec_coupon"
down_revision: str | None = "0413_ec_return_item"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.coupon import EcCoupon  # noqa: F401
    except ModuleNotFoundError:
        return
    EcCoupon.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.coupon import EcCoupon  # noqa: F401
    except ModuleNotFoundError:
        return
    EcCoupon.__table__.drop(bind=op.get_bind(), checkfirst=True)
