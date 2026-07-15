"""DocumentPermission lifecycle engine."""

from modules.document.domain.enums import (
    DocumentPermissionStatus,
)


class DocumentPermissionEngine:
    def revoke(self, row) -> None:
        row.status = DocumentPermissionStatus.REVOKED.value

