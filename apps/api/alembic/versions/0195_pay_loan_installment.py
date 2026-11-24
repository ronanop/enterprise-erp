"""Create PayLoanInstallment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0195_pay_loan_installment"
down_revision: str | None = "0194_pay_loan"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.loan_installment import PayLoanInstallment  # noqa: F401
    except ModuleNotFoundError:
        return
    PayLoanInstallment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.loan_installment import PayLoanInstallment  # noqa: F401
    except ModuleNotFoundError:
        return
    PayLoanInstallment.__table__.drop(bind=op.get_bind(), checkfirst=True)
