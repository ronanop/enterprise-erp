"""Create proc_order_header table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0065_proc_order_header"
down_revision: str | None = "0064_proc_vendor_comparison"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.order import ProcOrderHeader  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcOrderHeader.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.order import ProcOrderHeader  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcOrderHeader.__table__.drop(bind=op.get_bind(), checkfirst=True)
