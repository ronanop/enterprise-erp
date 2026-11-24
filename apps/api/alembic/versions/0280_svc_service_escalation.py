"""Create SvcServiceEscalation table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0280_svc_service_escalation"
down_revision: str | None = "0279_svc_service_sla"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_escalation import SvcServiceEscalation  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceEscalation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_escalation import SvcServiceEscalation  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceEscalation.__table__.drop(bind=op.get_bind(), checkfirst=True)
