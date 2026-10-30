"""Create EcListingInventory table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0404_ec_listing_inventory"
down_revision: str | None = "0403_ec_listing_price"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.listing_inventory import EcListingInventory  # noqa: F401
    except ModuleNotFoundError:
        return
    EcListingInventory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.listing_inventory import EcListingInventory  # noqa: F401
    except ModuleNotFoundError:
        return
    EcListingInventory.__table__.drop(bind=op.get_bind(), checkfirst=True)
