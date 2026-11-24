"""Create PayEmployeeSalaryComponent table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0186_pay_emp_salary_comp"
down_revision: str | None = "0185_pay_employee_salary"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.employee_salary_component import PayEmployeeSalaryComponent  # noqa: F401
    except ModuleNotFoundError:
        return
    PayEmployeeSalaryComponent.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.employee_salary_component import PayEmployeeSalaryComponent  # noqa: F401
    except ModuleNotFoundError:
        return
    PayEmployeeSalaryComponent.__table__.drop(bind=op.get_bind(), checkfirst=True)
