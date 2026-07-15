"""Policy lifecycle engine."""

from modules.grc.domain.enums import (
    PolicyStatus,
)
from modules.grc.domain.exceptions import (
    InvalidPolicyState,
)


class PolicyEngine:
    def submit(self, row) -> None:
        if row.status != PolicyStatus.DRAFT.value:
            raise InvalidPolicyState("Only draft policies can be submitted")
        row.status = PolicyStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != PolicyStatus.SUBMITTED.value:
            raise InvalidPolicyState("Only submitted policies can be approved")
        row.status = PolicyStatus.APPROVED.value

    def publish(self, row) -> None:
        if row.status != PolicyStatus.APPROVED.value:
            raise InvalidPolicyState("Only approved policies can be published")
        row.status = PolicyStatus.PUBLISHED.value

    def supersede(self, row) -> None:
        row.status = PolicyStatus.SUPERSEDED.value

    def retire(self, row) -> None:
        row.status = PolicyStatus.RETIRED.value

    def cancel(self, row) -> None:
        row.status = PolicyStatus.CANCELLED.value

