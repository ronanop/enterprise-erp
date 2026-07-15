"""Archive lifecycle engine."""

from modules.document.domain.enums import (
    ArchiveStatus,
)
from modules.document.domain.exceptions import (
    InvalidArchiveState,
)


class ArchiveEngine:
    def submit(self, row) -> None:
        if row.status != ArchiveStatus.DRAFT.value:
            raise InvalidArchiveState("Only draft archives can be submitted")
        row.status = ArchiveStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != ArchiveStatus.SUBMITTED.value:
            raise InvalidArchiveState("Only submitted archives can be approved")
        row.status = ArchiveStatus.ARCHIVED.value

    def restore(self, row) -> None:
        if row.status != ArchiveStatus.ARCHIVED.value:
            raise InvalidArchiveState("Only archived rows can restore")
        row.status = ArchiveStatus.RESTORED.value

    def dispose(self, row) -> None:
        row.status = ArchiveStatus.DISPOSED.value

