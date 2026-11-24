"""Create SalesPriceList table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0040_sales_price_list"
down_revision: str | None = "0039_create_sales_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.pricing import SalesPriceList
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesPriceList.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.pricing import SalesPriceList
    except ModuleNotFoundError:
        return
    SalesPriceList.__table__.drop(bind=op.get_bind(), checkfirst=True)
