"""Create PayReimbursement table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0193_pay_reimbursement"
down_revision: str | None = "0192_pay_bonus"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.reimbursement import PayReimbursement  # noqa: F401
    except ModuleNotFoundError:
        return
    PayReimbursement.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.reimbursement import PayReimbursement  # noqa: F401
    except ModuleNotFoundError:
        return
    PayReimbursement.__table__.drop(bind=op.get_bind(), checkfirst=True)
