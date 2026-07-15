"""DocumentWorkflow lifecycle engine."""

from modules.document.domain.enums import (
    DocumentWorkflowStatus,
)


class DocumentWorkflowEngine:
    def activate(self, row) -> None:
        row.status = DocumentWorkflowStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = DocumentWorkflowStatus.INACTIVE.value

