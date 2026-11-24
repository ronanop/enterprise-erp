"""Create payroll catalog type tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0181_pay_earn_deduct_types"
down_revision: str | None = "0180_pay_payroll_period"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.earning_type import PayEarningType  # noqa: F401
    except ModuleNotFoundError:
        return
    PayEarningType.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.earning_type import PayEarningType  # noqa: F401
    except ModuleNotFoundError:
        return
    PayEarningType.__table__.drop(bind=op.get_bind(), checkfirst=True)
