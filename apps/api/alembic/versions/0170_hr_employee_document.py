"""Create HrEmployeeDocument table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0170_hr_employee_document"
down_revision: str | None = "0169_hr_attendance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.employee_document import HrEmployeeDocument  # noqa: F401
    except ModuleNotFoundError:
        return
    HrEmployeeDocument.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.employee_document import HrEmployeeDocument  # noqa: F401
    except ModuleNotFoundError:
        return
    HrEmployeeDocument.__table__.drop(bind=op.get_bind(), checkfirst=True)
