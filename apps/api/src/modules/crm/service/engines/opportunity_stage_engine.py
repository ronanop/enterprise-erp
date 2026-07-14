"""Opportunity stage history engine."""

from modules.crm.domain.exceptions import InvalidOpportunityState


class OpportunityStageEngine:
    def validate_transition(self, from_stage: str, to_stage: str) -> None:
        allowed = {
            "qualification": {"discovery", "lost"},
            "discovery": {"proposal", "lost"},
            "proposal": {"negotiation", "lost"},
            "negotiation": {"won", "lost"},
        }
        if to_stage not in allowed.get(from_stage, set()) and from_stage != to_stage:
            raise InvalidOpportunityState(f"Invalid stage transition {from_stage} -> {to_stage}")
