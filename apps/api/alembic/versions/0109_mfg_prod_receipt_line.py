"""Create MfgProductionReceiptLine table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0109_mfg_prod_receipt_line"
down_revision: str | None = "0108_mfg_production_receipt"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.manufacturing.models.production_receipt import MfgProductionReceiptLine  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgProductionReceiptLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.manufacturing.models.production_receipt import MfgProductionReceiptLine  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgProductionReceiptLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
