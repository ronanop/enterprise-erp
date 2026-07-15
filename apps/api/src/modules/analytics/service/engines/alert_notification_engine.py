"""AlertNotification lifecycle engine."""

from modules.analytics.domain.enums import (
    AlertNotificationStatus,
)
from modules.analytics.domain.exceptions import (
    InvalidAlertNotificationState,
)


class AlertNotificationEngine:
    def acknowledge(self, row) -> None:
        if row.status not in {
            AlertNotificationStatus.OPEN.value,
        }:
            raise InvalidAlertNotificationState("Only open notifications can be acknowledged")
        row.status = AlertNotificationStatus.ACKNOWLEDGED.value
        row.delivery_status = "acknowledged"

    def close(self, row) -> None:
        row.status = AlertNotificationStatus.CLOSED.value
