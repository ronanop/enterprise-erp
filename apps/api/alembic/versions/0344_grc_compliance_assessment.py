"""Create GrcComplianceAssessment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0344_grc_compliance_assessment"
down_revision: str | None = "0343_grc_compliance_fw_req"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.compliance_assessment import GrcComplianceAssessment  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcComplianceAssessment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.compliance_assessment import GrcComplianceAssessment  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcComplianceAssessment.__table__.drop(bind=op.get_bind(), checkfirst=True)
