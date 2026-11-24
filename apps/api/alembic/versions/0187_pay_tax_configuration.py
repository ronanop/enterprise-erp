"""Create PayTaxConfiguration table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0187_pay_tax_configuration"
down_revision: str | None = "0186_pay_emp_salary_comp"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.tax_configuration import PayTaxConfiguration  # noqa: F401
    except ModuleNotFoundError:
        return
    PayTaxConfiguration.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.tax_configuration import PayTaxConfiguration  # noqa: F401
    except ModuleNotFoundError:
        return
    PayTaxConfiguration.__table__.drop(bind=op.get_bind(), checkfirst=True)
