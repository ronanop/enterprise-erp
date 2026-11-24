"""Create CrmCampaignMember table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0145_crm_campaign_member"
down_revision: str | None = "0144_crm_opportunity_stage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.campaign_member import CrmCampaignMember  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmCampaignMember.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.campaign_member import CrmCampaignMember  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmCampaignMember.__table__.drop(bind=op.get_bind(), checkfirst=True)
