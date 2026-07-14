"""Lead assignment engine."""

from modules.crm.domain.exceptions import InvalidAssignmentState
from modules.crm.models import CrmLeadAssignment


class LeadAssignmentEngine:
    def validate_active(self, assignment: CrmLeadAssignment) -> None:
        if assignment.status != "active":
            raise InvalidAssignmentState("Assignment is not active")

    def supersede(self, assignment: CrmLeadAssignment) -> None:
        self.validate_active(assignment)
        assignment.status = "superseded"
