"""Create HrDesignationAssignment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0162_hr_designation_assignment"
down_revision: str | None = "0161_hr_department_assignment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.designation_assignment import HrDesignationAssignment  # noqa: F401
    except ModuleNotFoundError:
        return
    HrDesignationAssignment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.designation_assignment import HrDesignationAssignment  # noqa: F401
    except ModuleNotFoundError:
        return
    HrDesignationAssignment.__table__.drop(bind=op.get_bind(), checkfirst=True)
