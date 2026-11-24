"""Create proc_requisition_header table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0057_proc_requisition_header"
down_revision: str | None = "0056_create_procurement_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.requisition import ProcRequisitionHeader  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcRequisitionHeader.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.requisition import ProcRequisitionHeader  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcRequisitionHeader.__table__.drop(bind=op.get_bind(), checkfirst=True)
