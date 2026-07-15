"""Template lifecycle engine."""

from modules.document.domain.enums import (
    TemplateStatus,
)


class TemplateEngine:
    def activate(self, row) -> None:
        row.status = TemplateStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = TemplateStatus.INACTIVE.value

    def archive(self, row) -> None:
        row.status = TemplateStatus.ARCHIVED.value

