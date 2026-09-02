"""Project lifecycle engine."""

from modules.project.domain.enums import (
    ProjectStatus,
)
from modules.project.domain.exceptions import (
    InvalidProjectState,
)


_TERMINAL_STATUSES = frozenset(
    {
        ProjectStatus.COMPLETED.value,
        ProjectStatus.CLOSED.value,
        ProjectStatus.CANCELLED.value,
    }
)


class ProjectEngine:
    def submit(self, row) -> None:
        if row.status != ProjectStatus.DRAFT.value:
            raise InvalidProjectState("Only draft projects can be submitted")
        row.status = ProjectStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != ProjectStatus.SUBMITTED.value:
            raise InvalidProjectState("Only submitted projects can be approved")
        row.status = ProjectStatus.APPROVED.value

    def start(self, row) -> None:
        if row.status not in {ProjectStatus.APPROVED.value, ProjectStatus.ON_HOLD.value}:
            raise InvalidProjectState("Project not startable")
        row.status = ProjectStatus.IN_PROGRESS.value

    def hold(self, row) -> None:
        if row.status != ProjectStatus.IN_PROGRESS.value:
            raise InvalidProjectState("Only in-progress projects can be held")
        row.status = ProjectStatus.ON_HOLD.value

    def complete(self, row) -> None:
        if row.status != ProjectStatus.IN_PROGRESS.value:
            raise InvalidProjectState("Only in-progress projects can be completed")
        row.status = ProjectStatus.COMPLETED.value

    def mark_completed(self, row) -> None:
        """Admin shortcut — mark project completed from any active lifecycle state."""
        if row.status in _TERMINAL_STATUSES:
            raise InvalidProjectState("Project is already completed or closed")
        row.status = ProjectStatus.COMPLETED.value

    def close(self, row) -> None:
        if row.status != ProjectStatus.COMPLETED.value:
            raise InvalidProjectState("Only completed projects can be closed")
        row.status = ProjectStatus.CLOSED.value

    def cancel(self, row) -> None:
        if row.status in {ProjectStatus.CLOSED.value, ProjectStatus.CANCELLED.value}:
            raise InvalidProjectState("Project already terminal")
        row.status = ProjectStatus.CANCELLED.value

