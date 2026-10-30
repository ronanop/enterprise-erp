"""Create SvcServiceSchedule table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0272_svc_service_schedule"
down_revision: str | None = "0271_svc_service_assignment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_schedule import SvcServiceSchedule  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceSchedule.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_schedule import SvcServiceSchedule  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceSchedule.__table__.drop(bind=op.get_bind(), checkfirst=True)
