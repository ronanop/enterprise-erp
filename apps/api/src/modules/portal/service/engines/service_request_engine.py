"""ServiceRequest lifecycle engine."""

from modules.portal.domain.enums import (
    ServiceRequestStatus,
)
from modules.portal.domain.exceptions import (
    InvalidServiceRequestState,
)


class ServiceRequestEngine:
    def submit(self, row) -> None:
        if row.status != ServiceRequestStatus.DRAFT.value:
            raise InvalidServiceRequestState("Only draft requests can be submitted")
        row.status = ServiceRequestStatus.SUBMITTED.value
