"""Create proc_order_line table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0066_proc_order_line"
down_revision: str | None = "0065_proc_order_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.order import ProcOrderLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcOrderLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.order import ProcOrderLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcOrderLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
