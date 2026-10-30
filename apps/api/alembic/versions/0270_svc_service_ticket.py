"""Create SvcServiceTicket table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0270_svc_service_ticket"
down_revision: str | None = "0269_svc_service_request"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_ticket import SvcServiceTicket  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceTicket.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_ticket import SvcServiceTicket  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceTicket.__table__.drop(bind=op.get_bind(), checkfirst=True)
