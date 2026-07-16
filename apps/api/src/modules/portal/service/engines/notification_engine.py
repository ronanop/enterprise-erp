"""Notification lifecycle engine."""

from modules.portal.domain.enums import (
    NotificationStatus,
)


class NotificationEngine:
    def acknowledge(self, row) -> None:
        row.delivery_status = "read"
        row.status = NotificationStatus.ARCHIVED.value
