"""Create PayPayrollRun table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0189_pay_payroll_run"
down_revision: str | None = "0188_pay_statutory_contrib"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.payroll_run import PayPayrollRun  # noqa: F401
    except ModuleNotFoundError:
        return
    PayPayrollRun.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.payroll_run import PayPayrollRun  # noqa: F401
    except ModuleNotFoundError:
        return
    PayPayrollRun.__table__.drop(bind=op.get_bind(), checkfirst=True)
