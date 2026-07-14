"""Quality audit lifecycle engine."""

from datetime import datetime, timezone

from modules.quality.domain.enums import AuditStatus
from modules.quality.domain.exceptions import InvalidAuditState
from modules.quality.models import QmQualityAudit


class AuditEngine:
    def validate_startable(self, audit: QmQualityAudit) -> None:
        if audit.status != AuditStatus.PLANNED.value:
            raise InvalidAuditState("Only planned audits can be started")

    def validate_completable(self, audit: QmQualityAudit) -> None:
        if audit.status != AuditStatus.IN_PROGRESS.value:
            raise InvalidAuditState("Only in-progress audits can be completed")

    def validate_closeable(self, audit: QmQualityAudit) -> None:
        if audit.status != AuditStatus.COMPLETED.value:
            raise InvalidAuditState("Only completed audits can be closed")

    def apply_start(self, audit: QmQualityAudit) -> None:
        self.validate_startable(audit)
        audit.status = AuditStatus.IN_PROGRESS.value
        audit.actual_start = datetime.now(timezone.utc)

    def apply_complete(self, audit: QmQualityAudit) -> None:
        self.validate_completable(audit)
        audit.status = AuditStatus.COMPLETED.value
        audit.actual_end = datetime.now(timezone.utc)

    def apply_close(self, audit: QmQualityAudit) -> None:
        self.validate_closeable(audit)
        audit.status = AuditStatus.CLOSED.value
