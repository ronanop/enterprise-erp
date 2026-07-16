"""SavedSearch lifecycle engine."""

from modules.portal.domain.enums import (
    SavedSearchStatus,
)


class SavedSearchEngine:
    def archive(self, row) -> None:
        row.status = SavedSearchStatus.ARCHIVED.value
