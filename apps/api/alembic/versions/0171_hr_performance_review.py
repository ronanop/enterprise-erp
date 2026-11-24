"""Create HrPerformanceReview table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0171_hr_performance_review"
down_revision: str | None = "0170_hr_employee_document"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.performance_review import HrPerformanceReview  # noqa: F401
    except ModuleNotFoundError:
        return
    HrPerformanceReview.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.performance_review import HrPerformanceReview  # noqa: F401
    except ModuleNotFoundError:
        return
    HrPerformanceReview.__table__.drop(bind=op.get_bind(), checkfirst=True)
