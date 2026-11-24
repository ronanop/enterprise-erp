"""Create proc_grn_header table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0067_proc_grn_header"
down_revision: str | None = "0066_proc_order_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.grn import ProcGrnHeader  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcGrnHeader.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.grn import ProcGrnHeader  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcGrnHeader.__table__.drop(bind=op.get_bind(), checkfirst=True)
