"""Create SvcServiceTask table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0274_svc_service_task"
down_revision: str | None = "0273_svc_service_work_order"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_task import SvcServiceTask  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceTask.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_task import SvcServiceTask  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceTask.__table__.drop(bind=op.get_bind(), checkfirst=True)
