"""Create EcOrder table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0407_ec_order"
down_revision: str | None = "0406_ec_cart_item"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.order import EcOrder  # noqa: F401
    except ModuleNotFoundError:
        return
    EcOrder.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.order import EcOrder  # noqa: F401
    except ModuleNotFoundError:
        return
    EcOrder.__table__.drop(bind=op.get_bind(), checkfirst=True)
