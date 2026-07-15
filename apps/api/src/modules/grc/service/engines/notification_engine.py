"""Notification lifecycle engine."""

from modules.grc.domain.enums import (
    NotificationStatus,
)


class NotificationEngine:
    def archive(self, row) -> None:
        row.status = NotificationStatus.ARCHIVED.value

