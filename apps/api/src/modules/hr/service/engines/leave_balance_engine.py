"""LeaveBalance lifecycle engine."""

from decimal import Decimal

from modules.hr.domain.enums import LeaveBalanceStatus
from modules.hr.domain.exceptions import InvalidLeaveBalanceState


class LeaveBalanceEngine:
    def apply_usage(self, row, days) -> None:
        if row.status != LeaveBalanceStatus.OPEN.value:
            raise InvalidLeaveBalanceState("Leave balance is closed")
        used = Decimal(str(row.used or 0)) + Decimal(str(days))
        closing = Decimal(str(row.opening_balance or 0)) + Decimal(str(row.accrued or 0)) - used
        if closing < 0:
            raise InvalidLeaveBalanceState("Insufficient leave balance")
        row.used = used
        row.closing_balance = closing

    def accrue(self, row, days) -> None:
        if row.status != LeaveBalanceStatus.OPEN.value:
            raise InvalidLeaveBalanceState("Leave balance is closed")
        row.accrued = Decimal(str(row.accrued or 0)) + Decimal(str(days))
        row.closing_balance = (
            Decimal(str(row.opening_balance or 0))
            + Decimal(str(row.accrued or 0))
            - Decimal(str(row.used or 0))
        )

    def apply_adjustment(self, row, days_delta) -> None:
        """Positive delta credits (accrue); negative delta debits (usage)."""
        delta = Decimal(str(days_delta))
        if delta == 0:
            return
        if delta > 0:
            self.accrue(row, delta)
        else:
            self.apply_usage(row, abs(delta))
