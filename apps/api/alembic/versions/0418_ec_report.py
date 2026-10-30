"""Create EcReport table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0418_ec_report"
down_revision: str | None = "0417_ec_notification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.report import EcReport  # noqa: F401
    except ModuleNotFoundError:
        return
    EcReport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.report import EcReport  # noqa: F401
    except ModuleNotFoundError:
        return
    EcReport.__table__.drop(bind=op.get_bind(), checkfirst=True)
