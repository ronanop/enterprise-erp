"""PayrollPeriod lifecycle engine."""

from modules.payroll.domain.enums import (
    PayrollPeriodStatus,
)
from modules.payroll.domain.exceptions import (
    InvalidPayrollPeriodState,
)


class PayrollPeriodEngine:
    def reopen(self, row) -> None:
        if row.status not in {
            PayrollPeriodStatus.CLOSED.value,
            PayrollPeriodStatus.CANCELLED.value,
        }:
            raise InvalidPayrollPeriodState("Only closed or cancelled periods can be reopened")
        row.status = PayrollPeriodStatus.OPEN.value

    def cancel(self, row) -> None:
        if row.status == PayrollPeriodStatus.CLOSED.value:
            raise InvalidPayrollPeriodState("Closed periods cannot be cancelled")
        row.status = PayrollPeriodStatus.CANCELLED.value

    def open(self, row) -> None:
        if row.status not in {
            PayrollPeriodStatus.CANCELLED.value,
            PayrollPeriodStatus.PROCESSING.value,
        }:
            raise InvalidPayrollPeriodState("Period not openable from current status")
        row.status = PayrollPeriodStatus.OPEN.value

    def start_processing(self, row) -> None:
        if row.status != PayrollPeriodStatus.OPEN.value:
            raise InvalidPayrollPeriodState("Only open periods can enter processing")
        row.status = PayrollPeriodStatus.PROCESSING.value

    def approve(self, row) -> None:
        if row.status != PayrollPeriodStatus.PROCESSING.value:
            raise InvalidPayrollPeriodState("Only processing periods can be approved")
        row.status = PayrollPeriodStatus.APPROVED.value

    def close(self, row) -> None:
        if row.status != PayrollPeriodStatus.APPROVED.value:
            raise InvalidPayrollPeriodState("Only approved periods can be closed")
        row.status = PayrollPeriodStatus.CLOSED.value

