"""AlertRule lifecycle engine."""

from modules.analytics.domain.enums import (
    AlertRuleStatus,
)
from modules.analytics.domain.exceptions import (
    InvalidAlertRuleState,
)


class AlertRuleEngine:
    def submit(self, row) -> None:
        if row.status != AlertRuleStatus.DRAFT.value:
            raise InvalidAlertRuleState("Only draft alert rules can be submitted")
        row.status = AlertRuleStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != AlertRuleStatus.SUBMITTED.value:
            raise InvalidAlertRuleState("Only submitted alert rules can be approved")
        row.status = AlertRuleStatus.APPROVED.value

    def activate(self, row) -> None:
        row.status = AlertRuleStatus.ACTIVE.value
        row.is_enabled = True

    def pause(self, row) -> None:
        row.status = AlertRuleStatus.PAUSED.value
        row.is_enabled = False

    def retire(self, row) -> None:
        row.status = AlertRuleStatus.RETIRED.value
        row.is_enabled = False
