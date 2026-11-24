"""Create SvcServiceRequest table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0269_svc_service_request"
down_revision: str | None = "0268_svc_service_category"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_request import SvcServiceRequest  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceRequest.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_request import SvcServiceRequest  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceRequest.__table__.drop(bind=op.get_bind(), checkfirst=True)
