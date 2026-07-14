"""Follow-up engine."""

from modules.crm.domain.enums import FollowupStatus
from modules.crm.domain.exceptions import InvalidFollowupState
from modules.crm.models import CrmFollowup


class FollowupEngine:
    def validate_completable(self, followup: CrmFollowup) -> None:
        if followup.status != FollowupStatus.SCHEDULED.value:
            raise InvalidFollowupState("Only scheduled follow-ups can be completed")

    def complete(self, followup: CrmFollowup) -> None:
        self.validate_completable(followup)
        followup.status = FollowupStatus.DONE.value
