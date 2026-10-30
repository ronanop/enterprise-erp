"""Create SalesDeliveryLine table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0049_sales_delivery_line"
down_revision: str | None = "0048_sales_delivery_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.delivery import SalesDeliveryLine
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesDeliveryLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.delivery import SalesDeliveryLine
    except ModuleNotFoundError:
        return
    SalesDeliveryLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
