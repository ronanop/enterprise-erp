"""Create EcSalesChannel table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0401_ec_sales_channel"
down_revision: str | None = "0400_ec_store"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.sales_channel import EcSalesChannel  # noqa: F401
    except ModuleNotFoundError:
        return
    EcSalesChannel.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.sales_channel import EcSalesChannel  # noqa: F401
    except ModuleNotFoundError:
        return
    EcSalesChannel.__table__.drop(bind=op.get_bind(), checkfirst=True)
