"""Create SvcServiceReport table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0286_svc_service_report"
down_revision: str | None = "0285_svc_service_contract"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_report import SvcServiceReport  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceReport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_report import SvcServiceReport  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceReport.__table__.drop(bind=op.get_bind(), checkfirst=True)
