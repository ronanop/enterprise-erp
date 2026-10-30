"""Create BiReport table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0358_bi_report"
down_revision: str | None = "0357_bi_dashboard_widget"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.analytics.models.report import BiReport  # noqa: F401
    except ModuleNotFoundError:
        return
    BiReport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.analytics.models.report import BiReport  # noqa: F401
    except ModuleNotFoundError:
        return
    BiReport.__table__.drop(bind=op.get_bind(), checkfirst=True)
