"""Create SalesOrderLine table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0047_sales_order_line"
down_revision: str | None = "0046_sales_order_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.order import SalesOrderLine
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesOrderLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.order import SalesOrderLine
    except ModuleNotFoundError:
        return
    SalesOrderLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
