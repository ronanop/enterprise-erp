"""Lead activity engine."""

from modules.crm.domain.enums import ActivityStatus
from modules.crm.domain.exceptions import InvalidLeadState
from modules.crm.models import CrmLeadActivity


class LeadActivityEngine:
    def validate_completable(self, activity: CrmLeadActivity) -> None:
        if activity.status != ActivityStatus.PLANNED.value:
            raise InvalidLeadState("Only planned activities can be completed")

    def complete(self, activity: CrmLeadActivity) -> None:
        self.validate_completable(activity)
        activity.status = ActivityStatus.COMPLETED.value
