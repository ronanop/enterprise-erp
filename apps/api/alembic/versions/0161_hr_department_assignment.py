"""Create HrDepartmentAssignment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0161_hr_department_assignment"
down_revision: str | None = "0160_hr_employment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.department_assignment import HrDepartmentAssignment  # noqa: F401
    except ModuleNotFoundError:
        return
    HrDepartmentAssignment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.department_assignment import HrDepartmentAssignment  # noqa: F401
    except ModuleNotFoundError:
        return
    HrDepartmentAssignment.__table__.drop(bind=op.get_bind(), checkfirst=True)
