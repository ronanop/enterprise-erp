"""Create PaySalaryStructureLine table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0184_pay_sal_struct_line"
down_revision: str | None = "0183_pay_salary_structure"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.salary_structure_line import PaySalaryStructureLine  # noqa: F401
    except ModuleNotFoundError:
        return
    PaySalaryStructureLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.salary_structure_line import PaySalaryStructureLine  # noqa: F401
    except ModuleNotFoundError:
        return
    PaySalaryStructureLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
