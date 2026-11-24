"""Create PayPayrollPosting table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0197_pay_payroll_posting"
down_revision: str | None = "0196_pay_payroll_adjustment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.payroll_posting import PayPayrollPosting  # noqa: F401
    except ModuleNotFoundError:
        return
    PayPayrollPosting.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.payroll_posting import PayPayrollPosting  # noqa: F401
    except ModuleNotFoundError:
        return
    PayPayrollPosting.__table__.drop(bind=op.get_bind(), checkfirst=True)
