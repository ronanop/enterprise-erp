"""DocumentAudit lifecycle engine."""

from modules.document.domain.enums import (
    DocumentAuditStatus,
)


class DocumentAuditEngine:
    def record(self, row) -> None:
        row.status = DocumentAuditStatus.RECORDED.value

