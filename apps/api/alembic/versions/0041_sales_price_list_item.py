"""Create SalesPriceListItem table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0041_sales_price_list_item"
down_revision: str | None = "0040_sales_price_list"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.pricing import SalesPriceListItem
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesPriceListItem.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.pricing import SalesPriceListItem
    except ModuleNotFoundError:
        return
    SalesPriceListItem.__table__.drop(bind=op.get_bind(), checkfirst=True)
