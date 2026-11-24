"""Create SvcServiceCategory table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0268_svc_service_category"
down_revision: str | None = "0267_create_service_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.service.models.service_category import SvcServiceCategory  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceCategory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.service.models.service_category import SvcServiceCategory  # noqa: F401
    except ModuleNotFoundError:
        return
    SvcServiceCategory.__table__.drop(bind=op.get_bind(), checkfirst=True)
