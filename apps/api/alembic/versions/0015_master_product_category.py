"""Create master_product_category table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0015_master_product_category"
down_revision: str | None = "0014_master_reference_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.master_data.models.category import MasterProductCategory  # noqa: F401
    except ModuleNotFoundError:
        return
    MasterProductCategory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.master_data.models.category import MasterProductCategory  # noqa: F401
    except ModuleNotFoundError:
        return
    MasterProductCategory.__table__.drop(bind=op.get_bind(), checkfirst=True)
