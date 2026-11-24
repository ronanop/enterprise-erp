"""Create MfgProductionOrder table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0102_mfg_production_order"
down_revision: str | None = "0101_mfg_routing_operation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.manufacturing.models.production_order import MfgProductionOrder  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgProductionOrder.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.manufacturing.models.production_order import MfgProductionOrder  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgProductionOrder.__table__.drop(bind=op.get_bind(), checkfirst=True)
