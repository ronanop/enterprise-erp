"""Campaign engine."""

from modules.crm.domain.enums import CampaignStatus
from modules.crm.domain.exceptions import InvalidCampaignState
from modules.crm.models import CrmCampaign


class CampaignEngine:
    def validate_activatable(self, campaign: CrmCampaign) -> None:
        if campaign.status != CampaignStatus.DRAFT.value:
            raise InvalidCampaignState("Only draft campaigns can be activated")

    def activate(self, campaign: CrmCampaign) -> None:
        self.validate_activatable(campaign)
        campaign.status = CampaignStatus.ACTIVE.value

    def complete(self, campaign: CrmCampaign) -> None:
        if campaign.status != CampaignStatus.ACTIVE.value:
            raise InvalidCampaignState("Only active campaigns can be completed")
        campaign.status = CampaignStatus.COMPLETED.value
