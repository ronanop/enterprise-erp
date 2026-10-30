"""Create PayPayrollAdjustment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0196_pay_payroll_adjustment"
down_revision: str | None = "0195_pay_loan_installment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.payroll_adjustment import PayPayrollAdjustment  # noqa: F401
    except ModuleNotFoundError:
        return
    PayPayrollAdjustment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.payroll_adjustment import PayPayrollAdjustment  # noqa: F401
    except ModuleNotFoundError:
        return
    PayPayrollAdjustment.__table__.drop(bind=op.get_bind(), checkfirst=True)
