"""Create PayPayrollPolicy table (Phase 0)."""

from collections.abc import Sequence

from alembic import op

revision: str = "0530_pay_payroll_policy"
down_revision: str | None = "0529_ess_phase6_compliance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.payroll_policy import PayPayrollPolicy  # noqa: F401
    except ModuleNotFoundError:
        return
    PayPayrollPolicy.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.payroll_policy import PayPayrollPolicy  # noqa: F401
    except ModuleNotFoundError:
        return
    PayPayrollPolicy.__table__.drop(bind=op.get_bind(), checkfirst=True)
