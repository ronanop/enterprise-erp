"""LeaveRequest lifecycle engine — Employee → Manager → HR."""

from modules.hr.domain.enums import LeaveRequestStatus
from modules.hr.domain.exceptions import InvalidLeaveRequestState


class LeaveRequestEngine:
    def submit(self, row) -> None:
        if row.status != LeaveRequestStatus.DRAFT.value:
            raise InvalidLeaveRequestState("Only draft leave requests can be submitted")
        row.status = LeaveRequestStatus.SUBMITTED.value

    def manager_approve(self, row) -> None:
        if row.status != LeaveRequestStatus.SUBMITTED.value:
            raise InvalidLeaveRequestState("Only submitted leave can be manager-approved")
        row.status = LeaveRequestStatus.MANAGER_APPROVED.value

    def approve(self, row) -> None:
        """HR final approval (also accepts legacy single-step submitted → approved)."""
        if row.status not in {
            LeaveRequestStatus.MANAGER_APPROVED.value,
            LeaveRequestStatus.SUBMITTED.value,
        }:
            raise InvalidLeaveRequestState("Leave must be submitted or manager-approved for HR approval")
        row.status = LeaveRequestStatus.APPROVED.value

    def reject(self, row) -> None:
        if row.status not in {
            LeaveRequestStatus.SUBMITTED.value,
            LeaveRequestStatus.MANAGER_APPROVED.value,
        }:
            raise InvalidLeaveRequestState("Only submitted/manager-approved leave can be rejected")
        row.status = LeaveRequestStatus.REJECTED.value

    def cancel(self, row) -> None:
        if row.status in {LeaveRequestStatus.APPROVED.value, LeaveRequestStatus.CANCELLED.value}:
            raise InvalidLeaveRequestState("Cannot cancel approved/cancelled leave")
        row.status = LeaveRequestStatus.CANCELLED.value
