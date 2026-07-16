"""PortalAccount lifecycle engine."""

from modules.portal.domain.enums import (
    PortalAccountStatus,
)
from modules.portal.domain.exceptions import (
    InvalidPortalAccountState,
)


class PortalAccountEngine:
    def submit(self, row) -> None:
        if row.status != PortalAccountStatus.DRAFT.value:
            raise InvalidPortalAccountState("Only draft accounts can be submitted")
        row.status = PortalAccountStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != PortalAccountStatus.SUBMITTED.value:
            raise InvalidPortalAccountState("Only submitted accounts can be approved")
        row.status = PortalAccountStatus.APPROVED.value
