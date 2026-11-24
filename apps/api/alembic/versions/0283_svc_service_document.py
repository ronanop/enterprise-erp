"""Create SvcServiceDocument table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0283_svc_service_document"
down_revision: str | None = "0282_svc_service_resolution"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_document import SvcServiceDocument  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceDocument.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_document import SvcServiceDocument  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceDocument.__table__.drop(bind=op.get_bind(), checkfirst=True)
