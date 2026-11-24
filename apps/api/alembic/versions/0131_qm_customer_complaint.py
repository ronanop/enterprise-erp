"""Create QmCustomerComplaint table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0131_qm_customer_complaint"
down_revision: str | None = "0130_qm_supplier_quality"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.customer_complaint import QmCustomerComplaint  # noqa: F401
    except ModuleNotFoundError:
        return
    QmCustomerComplaint.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.customer_complaint import QmCustomerComplaint  # noqa: F401
    except ModuleNotFoundError:
        return
    QmCustomerComplaint.__table__.drop(bind=op.get_bind(), checkfirst=True)
