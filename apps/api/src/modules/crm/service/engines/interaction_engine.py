"""Interaction engine."""

from modules.crm.domain.exceptions import InvalidLeadState
from modules.crm.models import CrmInteraction


class InteractionEngine:
    def validate_party(self, row: CrmInteraction) -> None:
        if not any([row.lead_id, row.opportunity_id, row.customer_id]):
            raise InvalidLeadState("Interaction requires lead, opportunity, or customer")
