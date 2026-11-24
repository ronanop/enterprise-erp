"""Create SvcServiceSla table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0279_svc_service_sla"
down_revision: str | None = "0278_svc_time_expense"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_sla import SvcServiceSla  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceSla.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_sla import SvcServiceSla  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceSla.__table__.drop(bind=op.get_bind(), checkfirst=True)
