"""Create GrcRiskAssessment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0341_grc_risk_assessment"
down_revision: str | None = "0340_grc_risk_register"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.risk_assessment import GrcRiskAssessment  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcRiskAssessment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.risk_assessment import GrcRiskAssessment  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcRiskAssessment.__table__.drop(bind=op.get_bind(), checkfirst=True)
