"""Create MfgProductionReceipt table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0108_mfg_production_receipt"
down_revision: str | None = "0107_mfg_material_return_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.manufacturing.models.production_receipt import MfgProductionReceipt  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgProductionReceipt.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.manufacturing.models.production_receipt import MfgProductionReceipt  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgProductionReceipt.__table__.drop(bind=op.get_bind(), checkfirst=True)
