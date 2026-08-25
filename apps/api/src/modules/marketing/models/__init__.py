"""Marketing ORM models."""

from modules.marketing.models.approval import MktApproval
from modules.marketing.models.brand_voice import MktBrandVoice
from modules.marketing.models.brand_voice_source import MktBrandVoiceSource
from modules.marketing.models.calendar_entry import MktCalendarEntry
from modules.marketing.models.campaign import MktCampaign
from modules.marketing.models.competitor import MktCompetitor
from modules.marketing.models.content_pillar import MktContentPillar
from modules.marketing.models.content_request import MktContentRequest
from modules.marketing.models.generated_content import MktGeneratedContent
from modules.marketing.models.generated_content_version import MktGeneratedContentVersion
from modules.marketing.models.m365_file import MktM365File
from modules.marketing.models.m365_meeting import MktM365Meeting
from modules.marketing.models.m365_workspace import MktM365Workspace
from modules.marketing.models.ops_event import MktOpsEvent
from modules.marketing.models.platform import MktPlatform
from modules.marketing.models.publish_job import MktPublishJob
from modules.marketing.models.research_report import MktResearchReport
from modules.marketing.models.social_account import MktSocialAccount
from modules.marketing.models.task import MktTask
from modules.marketing.models.time_entry import MktTimeEntry
from modules.marketing.models.trend_report import MktTrendReport

__all__ = [
    "MktPlatform",
    "MktCampaign",
    "MktContentPillar",
    "MktBrandVoice",
    "MktBrandVoiceSource",
    "MktSocialAccount",
    "MktContentRequest",
    "MktGeneratedContent",
    "MktGeneratedContentVersion",
    "MktResearchReport",
    "MktTrendReport",
    "MktCompetitor",
    "MktCalendarEntry",
    "MktPublishJob",
    "MktTask",
    "MktTimeEntry",
    "MktApproval",
    "MktM365Workspace",
    "MktM365File",
    "MktM365Meeting",
    "MktOpsEvent",
]
