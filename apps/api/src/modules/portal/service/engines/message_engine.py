"""Message lifecycle engine."""

from modules.portal.domain.enums import (
    MessageStatus,
)


class MessageEngine:
    def mark_read(self, row) -> None:
        row.status = MessageStatus.READ.value
