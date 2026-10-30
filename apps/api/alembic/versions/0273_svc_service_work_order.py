"""Create SvcServiceWorkOrder table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0273_svc_service_work_order"
down_revision: str | None = "0272_svc_service_schedule"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_work_order import SvcServiceWorkOrder  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceWorkOrder.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_work_order import SvcServiceWorkOrder  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceWorkOrder.__table__.drop(bind=op.get_bind(), checkfirst=True)
