"""Create SvcServiceChecklist table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0275_svc_service_checklist"
down_revision: str | None = "0274_svc_service_task"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_checklist import SvcServiceChecklist  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceChecklist.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_checklist import SvcServiceChecklist  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceChecklist.__table__.drop(bind=op.get_bind(), checkfirst=True)
