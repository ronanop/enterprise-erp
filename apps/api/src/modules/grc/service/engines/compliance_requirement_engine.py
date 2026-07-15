"""ComplianceRequirement lifecycle engine."""

from modules.grc.domain.enums import (
    ComplianceRequirementStatus,
)


class ComplianceRequirementEngine:
    def activate(self, row) -> None:
        row.status = ComplianceRequirementStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = ComplianceRequirementStatus.INACTIVE.value

