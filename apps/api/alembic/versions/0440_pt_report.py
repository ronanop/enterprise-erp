"""Create PtReport table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0440_pt_report"
down_revision: str | None = "0439_pt_login_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.portal.models.report import PtReport  # noqa: F401
    except ModuleNotFoundError:
        return
    PtReport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.portal.models.report import PtReport  # noqa: F401
    except ModuleNotFoundError:
        return
    PtReport.__table__.drop(bind=op.get_bind(), checkfirst=True)
