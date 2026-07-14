"""Lead lifecycle engine."""

from modules.crm.domain.enums import LeadStatus
from modules.crm.domain.exceptions import InvalidLeadState
from modules.crm.models import CrmLead


class LeadEngine:
    def validate_assignable(self, lead: CrmLead) -> None:
        if lead.status in {LeadStatus.CONVERTED.value, LeadStatus.LOST.value}:
            raise InvalidLeadState("Converted or lost leads cannot be assigned")

    def validate_convertible(self, lead: CrmLead) -> None:
        if lead.status not in {LeadStatus.QUALIFIED.value, LeadStatus.CONTACTED.value, LeadStatus.ASSIGNED.value}:
            raise InvalidLeadState("Lead must be contactable/qualified to convert")
        if not lead.mobile:
            raise InvalidLeadState("Mobile is required for conversion")
        if not lead.email and not lead.company_name:
            raise InvalidLeadState("Email or company name required for conversion")

    def apply_assign(self, lead: CrmLead) -> None:
        self.validate_assignable(lead)
        lead.status = LeadStatus.ASSIGNED.value

    def apply_convert(self, lead: CrmLead) -> None:
        self.validate_convertible(lead)
        lead.status = LeadStatus.CONVERTED.value
