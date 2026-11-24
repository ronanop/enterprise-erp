"""Create fin_asset_transaction table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0036_fin_asset_transaction"
down_revision: str | None = "0035_fin_cost_center_allocation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.finance.models.asset import FinAssetTransaction  # noqa: F401
    except ModuleNotFoundError:
        return
    FinAssetTransaction.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.finance.models.asset import FinAssetTransaction  # noqa: F401
    except ModuleNotFoundError:
        return
    FinAssetTransaction.__table__.drop(bind=op.get_bind(), checkfirst=True)
