"""Campaign member engine."""

from modules.crm.domain.exceptions import InvalidCampaignMemberState
from modules.crm.models import CrmCampaignMember


class CampaignMemberEngine:
    def validate_member(self, member: CrmCampaignMember) -> None:
        has_lead = member.lead_id is not None
        has_customer = member.customer_id is not None
        if has_lead == has_customer:
            raise InvalidCampaignMemberState("Exactly one of lead_id or customer_id is required")
