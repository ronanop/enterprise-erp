"""Create proc_return_line table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0074_proc_return_line"
down_revision: str | None = "0073_proc_return_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.return_doc import ProcReturnLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcReturnLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.return_doc import ProcReturnLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcReturnLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
