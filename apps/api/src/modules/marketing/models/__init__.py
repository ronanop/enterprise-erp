"""Marketing ORM models."""

from modules.marketing.models.activity_log import MktActivityLog
from modules.marketing.models.campaign import MktCampaign
from modules.marketing.models.campaign_audience import MktCampaignAudience
from modules.marketing.models.channel import MktChannel
from modules.marketing.models.content_approval import MktContentApproval
from modules.marketing.models.content_assignment import MktContentAssignment
from modules.marketing.models.content_asset_link import MktContentAssetLink
from modules.marketing.models.content_item import MktContentItem
from modules.marketing.models.content_verification import MktContentVerification
from modules.marketing.models.verification_item import MktVerificationItem
from modules.marketing.models.media_asset import MktMediaAsset
from modules.marketing.models.publication import MktPublication

__all__ = [
    "MktActivityLog",
    "MktCampaign",
    "MktCampaignAudience",
    "MktChannel",
    "MktContentApproval",
    "MktContentAssignment",
    "MktContentAssetLink",
    "MktContentItem",
    "MktContentVerification",
    "MktVerificationItem",
    "MktMediaAsset",
    "MktPublication",
]
