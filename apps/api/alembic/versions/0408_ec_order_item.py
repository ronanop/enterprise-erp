"""Create EcOrderItem table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0408_ec_order_item"
down_revision: str | None = "0407_ec_order"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.order_item import EcOrderItem  # noqa: F401
    except ModuleNotFoundError:
        return
    EcOrderItem.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.order_item import EcOrderItem  # noqa: F401
    except ModuleNotFoundError:
        return
    EcOrderItem.__table__.drop(bind=op.get_bind(), checkfirst=True)
