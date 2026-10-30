"""Create EcPromotion table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0415_ec_promotion"
down_revision: str | None = "0414_ec_coupon"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.promotion import EcPromotion  # noqa: F401
    except ModuleNotFoundError:
        return
    EcPromotion.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.promotion import EcPromotion  # noqa: F401
    except ModuleNotFoundError:
        return
    EcPromotion.__table__.drop(bind=op.get_bind(), checkfirst=True)
