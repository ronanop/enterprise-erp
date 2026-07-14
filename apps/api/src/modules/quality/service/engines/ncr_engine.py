"""NCR lifecycle engine."""

from modules.quality.domain.enums import NcrStatus
from modules.quality.domain.exceptions import InvalidNcrState
from modules.quality.models import QmNcr


class NcrEngine:
    def validate_submittable(self, ncr: QmNcr) -> None:
        if ncr.status != NcrStatus.DRAFT.value:
            raise InvalidNcrState("Only draft NCRs can be submitted")
        if not ncr.description:
            raise InvalidNcrState("Description is required")

    def validate_approvable(self, ncr: QmNcr) -> None:
        if ncr.status != NcrStatus.SUBMITTED.value:
            raise InvalidNcrState("Only submitted NCRs can be approved")

    def validate_closeable(self, ncr: QmNcr) -> None:
        if ncr.status != NcrStatus.APPROVED.value:
            raise InvalidNcrState("Only approved NCRs can be closed")

    def apply_submit(self, ncr: QmNcr) -> None:
        self.validate_submittable(ncr)
        ncr.status = NcrStatus.SUBMITTED.value

    def apply_approve(self, ncr: QmNcr) -> None:
        self.validate_approvable(ncr)
        ncr.status = NcrStatus.APPROVED.value

    def apply_close(self, ncr: QmNcr) -> None:
        self.validate_closeable(ncr)
        ncr.status = NcrStatus.CLOSED.value
