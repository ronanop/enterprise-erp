"""Create grc compliance framework and requirement tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0343_grc_compliance_fw_req"
down_revision: str | None = "0342_grc_risk_treatment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.compliance_framework import GrcComplianceFramework  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcComplianceFramework.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.compliance_framework import GrcComplianceFramework  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcComplianceFramework.__table__.drop(bind=op.get_bind(), checkfirst=True)
