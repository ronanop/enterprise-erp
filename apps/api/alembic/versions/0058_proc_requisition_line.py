"""Create proc_requisition_line table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0058_proc_requisition_line"
down_revision: str | None = "0057_proc_requisition_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.requisition import ProcRequisitionLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcRequisitionLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.requisition import ProcRequisitionLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcRequisitionLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
