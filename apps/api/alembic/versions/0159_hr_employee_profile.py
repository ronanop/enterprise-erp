"""Create HrEmployeeProfile table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0159_hr_employee_profile"
down_revision: str | None = "0158_hr_designation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.employee_profile import HrEmployeeProfile  # noqa: F401
    except ModuleNotFoundError:
        return
    HrEmployeeProfile.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.employee_profile import HrEmployeeProfile  # noqa: F401
    except ModuleNotFoundError:
        return
    HrEmployeeProfile.__table__.drop(bind=op.get_bind(), checkfirst=True)
