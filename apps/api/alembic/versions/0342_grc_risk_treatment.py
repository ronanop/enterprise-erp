"""Create GrcRiskTreatment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0342_grc_risk_treatment"
down_revision: str | None = "0341_grc_risk_assessment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.risk_treatment import GrcRiskTreatment  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcRiskTreatment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.risk_treatment import GrcRiskTreatment  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcRiskTreatment.__table__.drop(bind=op.get_bind(), checkfirst=True)
