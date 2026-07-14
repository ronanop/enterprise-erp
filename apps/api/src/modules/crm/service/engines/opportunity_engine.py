"""Opportunity lifecycle engine."""

from decimal import Decimal

from modules.crm.domain.enums import OpportunityStage, OpportunityStatus
from modules.crm.domain.exceptions import InvalidOpportunityState
from modules.crm.domain.value_objects import ForecastAmount
from modules.crm.models import CrmOpportunity


class OpportunityEngine:
    def validate_closeable(self, opp: CrmOpportunity, *, won: bool) -> None:
        if opp.status != OpportunityStatus.OPEN.value:
            raise InvalidOpportunityState("Only open opportunities can be closed")
        if won and opp.customer_id is None:
            raise InvalidOpportunityState("Customer is required to win opportunity")

    def compute_forecast(self, opp: CrmOpportunity) -> Decimal:
        return ForecastAmount(
            expected_revenue=Decimal(str(opp.expected_revenue or 0)),
            probability_percent=Decimal(str(opp.probability_percent or 0)),
        ).amount

    def apply_win(self, opp: CrmOpportunity) -> None:
        self.validate_closeable(opp, won=True)
        opp.status = OpportunityStatus.WON.value
        opp.current_stage = OpportunityStage.WON.value
        opp.probability_percent = Decimal("100")
        opp.forecast_amount = self.compute_forecast(opp)

    def apply_loss(self, opp: CrmOpportunity) -> None:
        self.validate_closeable(opp, won=False)
        opp.status = OpportunityStatus.LOST.value
        opp.current_stage = OpportunityStage.LOST.value
        opp.probability_percent = Decimal("0")
        opp.forecast_amount = Decimal("0")
