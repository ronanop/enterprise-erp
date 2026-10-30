"""Create fin_cost_center_allocation table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0035_fin_cost_center_allocation"
down_revision: str | None = "0034_fin_tax_register"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.finance.models.allocation import FinCostCenterAllocation  # noqa: F401
    except ModuleNotFoundError:
        return
    FinCostCenterAllocation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.finance.models.allocation import FinCostCenterAllocation  # noqa: F401
    except ModuleNotFoundError:
        return
    FinCostCenterAllocation.__table__.drop(bind=op.get_bind(), checkfirst=True)
