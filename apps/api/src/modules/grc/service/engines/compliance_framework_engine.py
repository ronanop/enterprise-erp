"""ComplianceFramework lifecycle engine."""

from modules.grc.domain.enums import (
    ComplianceFrameworkStatus,
)


class ComplianceFrameworkEngine:
    def activate(self, row) -> None:
        row.status = ComplianceFrameworkStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = ComplianceFrameworkStatus.INACTIVE.value

    def retire(self, row) -> None:
        row.status = ComplianceFrameworkStatus.RETIRED.value

