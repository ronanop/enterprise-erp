"""Create proc_rfq_vendor table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0061_proc_rfq_vendor"
down_revision: str | None = "0060_proc_rfq_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.rfq import ProcRfqVendor  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcRfqVendor.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.rfq import ProcRfqVendor  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcRfqVendor.__table__.drop(bind=op.get_bind(), checkfirst=True)
