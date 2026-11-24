"""Create QmSupplierQuality table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0130_qm_supplier_quality"
down_revision: str | None = "0129_qm_preventive_action"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.supplier_quality import QmSupplierQuality  # noqa: F401
    except ModuleNotFoundError:
        return
    QmSupplierQuality.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.supplier_quality import QmSupplierQuality  # noqa: F401
    except ModuleNotFoundError:
        return
    QmSupplierQuality.__table__.drop(bind=op.get_bind(), checkfirst=True)
