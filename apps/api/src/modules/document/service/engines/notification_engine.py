"""Notification lifecycle engine."""

from modules.document.domain.enums import (
    NotificationStatus,
)


class NotificationEngine:
    def archive(self, row) -> None:
        row.status = NotificationStatus.ARCHIVED.value

