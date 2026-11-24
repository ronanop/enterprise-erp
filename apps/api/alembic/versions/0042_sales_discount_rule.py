"""Create SalesDiscountRule table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0042_sales_discount_rule"
down_revision: str | None = "0041_sales_price_list_item"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.pricing import SalesDiscountRule
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesDiscountRule.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.pricing import SalesDiscountRule
    except ModuleNotFoundError:
        return
    SalesDiscountRule.__table__.drop(bind=op.get_bind(), checkfirst=True)
