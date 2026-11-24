"""Create proc_grn_line table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0068_proc_grn_line"
down_revision: str | None = "0067_proc_grn_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.grn import ProcGrnLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcGrnLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.grn import ProcGrnLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcGrnLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
