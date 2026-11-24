"""Create EcMarketplaceConnector table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0416_ec_marketplace_connector"
down_revision: str | None = "0415_ec_promotion"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.marketplace_connector import EcMarketplaceConnector  # noqa: F401
    except ModuleNotFoundError:
        return
    EcMarketplaceConnector.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.marketplace_connector import EcMarketplaceConnector  # noqa: F401
    except ModuleNotFoundError:
        return
    EcMarketplaceConnector.__table__.drop(bind=op.get_bind(), checkfirst=True)
