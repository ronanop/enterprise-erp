"""RiskRegister lifecycle engine."""

from modules.grc.domain.enums import (
    RiskRegisterStatus,
)
from modules.grc.domain.exceptions import (
    InvalidRiskRegisterState,
)


class RiskRegisterEngine:
    def submit(self, row) -> None:
        if row.status != RiskRegisterStatus.DRAFT.value:
            raise InvalidRiskRegisterState("Only draft risks can be submitted")
        row.status = RiskRegisterStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != RiskRegisterStatus.SUBMITTED.value:
            raise InvalidRiskRegisterState("Only submitted risks can be approved")
        row.status = RiskRegisterStatus.APPROVED.value

    def open(self, row) -> None:
        row.status = RiskRegisterStatus.OPEN.value

    def mitigate(self, row) -> None:
        row.status = RiskRegisterStatus.MITIGATED.value

    def accept(self, row) -> None:
        row.status = RiskRegisterStatus.ACCEPTED.value

    def close(self, row) -> None:
        row.status = RiskRegisterStatus.CLOSED.value

    def cancel(self, row) -> None:
        row.status = RiskRegisterStatus.CANCELLED.value

