"""Create CrmCampaign table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0139_crm_campaign"
down_revision: str | None = "0138_crm_pipeline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.campaign import CrmCampaign  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmCampaign.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.campaign import CrmCampaign  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmCampaign.__table__.drop(bind=op.get_bind(), checkfirst=True)
