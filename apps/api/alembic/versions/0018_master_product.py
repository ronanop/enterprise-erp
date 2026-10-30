"""Create master_product table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0018_master_product"
down_revision: str | None = "0017_master_customer_vendor"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.master_data.models.product import MasterProduct  # noqa: F401
    except ModuleNotFoundError:
        return
    MasterProduct.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.master_data.models.product import MasterProduct  # noqa: F401
    except ModuleNotFoundError:
        return
    MasterProduct.__table__.drop(bind=op.get_bind(), checkfirst=True)
