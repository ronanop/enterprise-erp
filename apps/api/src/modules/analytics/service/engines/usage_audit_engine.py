"""UsageAudit lifecycle engine."""

from modules.analytics.domain.enums import (
    UsageAuditStatus,
)


class UsageAuditEngine:
    def record(self, row) -> None:
        row.status = UsageAuditStatus.RECORDED.value
