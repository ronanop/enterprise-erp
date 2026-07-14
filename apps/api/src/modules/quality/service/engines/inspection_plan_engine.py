"""Inspection plan activation engine."""

from modules.quality.domain.enums import ActiveInactive, PlanStatus
from modules.quality.domain.exceptions import InvalidPlanState
from modules.quality.models import QmInspectionPlan


class InspectionPlanEngine:
    def validate_activatable(self, plan: QmInspectionPlan) -> None:
        if plan.status != PlanStatus.DRAFT.value:
            raise InvalidPlanState("Only draft plans can be activated")
        if not plan.plan_name:
            raise InvalidPlanState("Plan name is required")
        active_chars = [
            c
            for c in plan.characteristics
            if not c.is_deleted and c.status == ActiveInactive.ACTIVE.value
        ]
        if not active_chars:
            raise InvalidPlanState("Plan must have at least one active characteristic")
