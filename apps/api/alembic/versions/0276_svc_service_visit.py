"""Create SvcServiceVisit table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0276_svc_service_visit"
down_revision: str | None = "0275_svc_service_checklist"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_visit import SvcServiceVisit  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceVisit.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_visit import SvcServiceVisit  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceVisit.__table__.drop(bind=op.get_bind(), checkfirst=True)
