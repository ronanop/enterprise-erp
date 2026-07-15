"""Folder lifecycle engine."""

from modules.document.domain.enums import (
    FolderStatus,
)


class FolderEngine:
    def activate(self, row) -> None:
        row.status = FolderStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = FolderStatus.INACTIVE.value

    def archive(self, row) -> None:
        row.status = FolderStatus.ARCHIVED.value

