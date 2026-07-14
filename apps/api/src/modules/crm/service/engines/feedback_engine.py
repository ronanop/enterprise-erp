"""Customer feedback engine."""

from modules.crm.domain.enums import FeedbackStatus
from modules.crm.domain.exceptions import InvalidFeedbackState
from modules.crm.models import CrmCustomerFeedback


class FeedbackEngine:
    def validate_closable(self, row: CrmCustomerFeedback) -> None:
        if row.status == FeedbackStatus.CLOSED.value:
            raise InvalidFeedbackState("Feedback already closed")

    def close(self, row: CrmCustomerFeedback) -> None:
        self.validate_closable(row)
        row.status = FeedbackStatus.CLOSED.value
