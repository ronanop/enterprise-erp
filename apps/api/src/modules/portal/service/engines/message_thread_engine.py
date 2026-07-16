"""MessageThread lifecycle engine."""

from modules.portal.domain.enums import (
    MessageThreadStatus,
)


class MessageThreadEngine:
    def close(self, row) -> None:
        row.status = MessageThreadStatus.CLOSED.value
