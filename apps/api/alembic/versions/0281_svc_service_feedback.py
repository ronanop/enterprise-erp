"""Create SvcServiceFeedback table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0281_svc_service_feedback"
down_revision: str | None = "0280_svc_service_escalation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_feedback import SvcServiceFeedback  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceFeedback.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_feedback import SvcServiceFeedback  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceFeedback.__table__.drop(bind=op.get_bind(), checkfirst=True)
