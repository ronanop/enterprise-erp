"""TemplateField lifecycle engine."""

from modules.document.domain.enums import (
    TemplateFieldStatus,
)


class TemplateFieldEngine:
    def activate(self, row) -> None:
        row.status = TemplateFieldStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = TemplateFieldStatus.INACTIVE.value

