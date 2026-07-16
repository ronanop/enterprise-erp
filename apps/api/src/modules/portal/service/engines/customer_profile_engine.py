"""CustomerProfile lifecycle engine."""

from modules.portal.domain.enums import (
    CustomerProfileStatus,
)
from modules.portal.domain.exceptions import (
    InvalidCustomerProfileState,
)


class CustomerProfileEngine:
    def submit(self, row) -> None:
        if row.status != CustomerProfileStatus.DRAFT.value:
            raise InvalidCustomerProfileState("Only draft profiles can be submitted")
        row.status = CustomerProfileStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != CustomerProfileStatus.SUBMITTED.value:
            raise InvalidCustomerProfileState("Only submitted profiles can be approved")
        row.status = CustomerProfileStatus.APPROVED.value
