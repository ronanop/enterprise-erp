"""Create GrcRiskCategory table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0339_grc_risk_category"
down_revision: str | None = "0338_grc_control_test"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.risk_category import GrcRiskCategory  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcRiskCategory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.risk_category import GrcRiskCategory  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcRiskCategory.__table__.drop(bind=op.get_bind(), checkfirst=True)
