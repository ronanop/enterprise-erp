"""Create PayStatutoryContribution table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0188_pay_statutory_contrib"
down_revision: str | None = "0187_pay_tax_configuration"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.payroll.models.statutory_contribution import PayStatutoryContribution  # noqa: F401
    except ModuleNotFoundError:
        return
    PayStatutoryContribution.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.payroll.models.statutory_contribution import PayStatutoryContribution  # noqa: F401
    except ModuleNotFoundError:
        return
    PayStatutoryContribution.__table__.drop(bind=op.get_bind(), checkfirst=True)
