"""Create GrcRiskRegister table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0340_grc_risk_register"
down_revision: str | None = "0339_grc_risk_category"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.risk_register import GrcRiskRegister  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcRiskRegister.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.risk_register import GrcRiskRegister  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcRiskRegister.__table__.drop(bind=op.get_bind(), checkfirst=True)
