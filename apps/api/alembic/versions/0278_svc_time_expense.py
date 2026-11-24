"""Create service time entry and expense tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0278_svc_time_expense"
down_revision: str | None = "0277_svc_service_material"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_time_entry import SvcServiceTimeEntry  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceTimeEntry.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_time_entry import SvcServiceTimeEntry  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceTimeEntry.__table__.drop(bind=op.get_bind(), checkfirst=True)
