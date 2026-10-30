"""Create SalesOrderHeader table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0046_sales_order_header"
down_revision: str | None = "0045_sales_quotation_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.order import SalesOrderHeader
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesOrderHeader.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.order import SalesOrderHeader
    except ModuleNotFoundError:
        return
    SalesOrderHeader.__table__.drop(bind=op.get_bind(), checkfirst=True)
