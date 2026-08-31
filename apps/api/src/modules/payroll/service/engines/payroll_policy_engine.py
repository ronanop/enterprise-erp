"""PayrollPolicy lifecycle rules."""

from modules.payroll.domain.enums import PayrollPolicyStatus
from modules.payroll.domain.exceptions import InvalidSalaryStructureState


class PayrollPolicyEngine:
    def activate(self, row) -> None:
        if row.status not in {
            PayrollPolicyStatus.DRAFT.value,
            PayrollPolicyStatus.ARCHIVED.value,
        }:
            raise InvalidSalaryStructureState("Policy not activatable from current status")
        row.status = PayrollPolicyStatus.ACTIVE.value

    def archive(self, row) -> None:
        if row.status == PayrollPolicyStatus.ARCHIVED.value:
            raise InvalidSalaryStructureState("Policy already archived")
        row.status = PayrollPolicyStatus.ARCHIVED.value
