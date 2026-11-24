"""Create PaySalaryComponent table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0182_pay_salary_component"
down_revision: str | None = "0181_pay_earn_deduct_types"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.salary_component import PaySalaryComponent  # noqa: F401
    except ModuleNotFoundError:
        return
    PaySalaryComponent.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.salary_component import PaySalaryComponent  # noqa: F401
    except ModuleNotFoundError:
        return
    PaySalaryComponent.__table__.drop(bind=op.get_bind(), checkfirst=True)
