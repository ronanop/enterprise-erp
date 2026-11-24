"""Create proc_vendor_performance table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0075_proc_vendor_performance"
down_revision: str | None = "0074_proc_return_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.performance import ProcVendorPerformance  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcVendorPerformance.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.performance import ProcVendorPerformance  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcVendorPerformance.__table__.drop(bind=op.get_bind(), checkfirst=True)
