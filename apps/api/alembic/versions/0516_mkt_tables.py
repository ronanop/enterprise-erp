"""Create marketing module tables."""

from collections.abc import Sequence

from alembic import op

from modules.marketing.models.brand_voice import MktBrandVoice
from modules.marketing.models.brand_voice_source import MktBrandVoiceSource
from modules.marketing.models.calendar_entry import MktCalendarEntry
from modules.marketing.models.campaign import MktCampaign
from modules.marketing.models.competitor import MktCompetitor
from modules.marketing.models.content_pillar import MktContentPillar
from modules.marketing.models.content_request import MktContentRequest
from modules.marketing.models.generated_content import MktGeneratedContent
from modules.marketing.models.generated_content_version import MktGeneratedContentVersion
from modules.marketing.models.platform import MktPlatform
from modules.marketing.models.publish_job import MktPublishJob
from modules.marketing.models.research_report import MktResearchReport
from modules.marketing.models.social_account import MktSocialAccount
from modules.marketing.models.trend_report import MktTrendReport

revision: str = "0516_mkt_tables"
down_revision: str | Sequence[str] | None = "0515_create_marketing_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = [
    MktPlatform,
    MktCampaign,
    MktContentPillar,
    MktBrandVoice,
    MktBrandVoiceSource,
    MktSocialAccount,
    MktContentRequest,
    MktGeneratedContent,
    MktGeneratedContentVersion,
    MktResearchReport,
    MktTrendReport,
    MktCompetitor,
    MktCalendarEntry,
    MktPublishJob,
]


def upgrade() -> None:
    bind = op.get_bind()
    for model in _TABLES:
        model.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for model in reversed(_TABLES):
        model.__table__.drop(bind=bind, checkfirst=True)
