"""RetentionPolicy lifecycle engine."""

from modules.document.domain.enums import (
    RetentionPolicyStatus,
)
from modules.document.domain.exceptions import (
    InvalidRetentionPolicyState,
)


class RetentionPolicyEngine:
    def submit(self, row) -> None:
        if row.status != RetentionPolicyStatus.DRAFT.value:
            raise InvalidRetentionPolicyState("Only draft policies can be submitted")
        row.status = RetentionPolicyStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != RetentionPolicyStatus.SUBMITTED.value:
            raise InvalidRetentionPolicyState("Only submitted policies can be approved")
        row.status = RetentionPolicyStatus.APPROVED.value

    def activate(self, row) -> None:
        if row.status != RetentionPolicyStatus.APPROVED.value:
            raise InvalidRetentionPolicyState("Only approved policies can activate")
        row.status = RetentionPolicyStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = RetentionPolicyStatus.INACTIVE.value

