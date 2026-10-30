"""Create CrmOpportunityStage table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0144_crm_opportunity_stage"
down_revision: str | None = "0143_crm_opportunity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.opportunity_stage import CrmOpportunityStage  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmOpportunityStage.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.opportunity_stage import CrmOpportunityStage  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmOpportunityStage.__table__.drop(bind=op.get_bind(), checkfirst=True)
