"""Customer complaint lifecycle engine."""

from modules.quality.domain.enums import ComplaintStatus
from modules.quality.domain.exceptions import InvalidComplaintState
from modules.quality.models import QmCustomerComplaint


class ComplaintEngine:
    def validate_closable(self, complaint: QmCustomerComplaint) -> None:
        if complaint.status not in {
            ComplaintStatus.INVESTIGATING.value,
            ComplaintStatus.NCR_RAISED.value,
            ComplaintStatus.CAPA_LINKED.value,
        }:
            raise InvalidComplaintState("Complaint cannot be closed from current status")

    def advance_to_investigating(self, complaint: QmCustomerComplaint) -> None:
        if complaint.status != ComplaintStatus.DRAFT.value:
            raise InvalidComplaintState("Only draft complaints can move to investigating")
        complaint.status = ComplaintStatus.INVESTIGATING.value

    def advance_to_ncr_raised(self, complaint: QmCustomerComplaint) -> None:
        if complaint.status != ComplaintStatus.INVESTIGATING.value:
            raise InvalidComplaintState("Complaint must be investigating to raise NCR")
        complaint.status = ComplaintStatus.NCR_RAISED.value

    def advance_to_capa_linked(self, complaint: QmCustomerComplaint) -> None:
        if complaint.status != ComplaintStatus.NCR_RAISED.value:
            raise InvalidComplaintState("Complaint must have NCR raised before CAPA link")
        complaint.status = ComplaintStatus.CAPA_LINKED.value

    def apply_close(self, complaint: QmCustomerComplaint) -> None:
        self.validate_closable(complaint)
        complaint.status = ComplaintStatus.CLOSED.value
