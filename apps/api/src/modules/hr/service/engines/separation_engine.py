"""Separation lifecycle engine."""

from modules.hr.domain.enums import SeparationStatus
from modules.hr.domain.exceptions import InvalidSeparationState


class SeparationEngine:
    def submit(self, row) -> None:
        if row.status != SeparationStatus.DRAFT.value:
            raise InvalidSeparationState("Only draft separations can be submitted")
        row.status = SeparationStatus.SUBMITTED.value

    def manager_approve(self, row) -> None:
        if row.status != SeparationStatus.SUBMITTED.value:
            raise InvalidSeparationState("Only submitted separations can receive manager approval")
        row.status = SeparationStatus.MANAGER_APPROVED.value

    def it_approve(self, row) -> None:
        if row.status != SeparationStatus.MANAGER_APPROVED.value:
            raise InvalidSeparationState("Manager approval required before IT approval")
        row.status = SeparationStatus.IT_APPROVED.value

    def accounts_approve(self, row) -> None:
        if row.status != SeparationStatus.IT_APPROVED.value:
            raise InvalidSeparationState("IT approval required before Accounts approval")
        row.status = SeparationStatus.ACCOUNTS_APPROVED.value

    def hr_approve(self, row) -> None:
        if row.status != SeparationStatus.ACCOUNTS_APPROVED.value:
            raise InvalidSeparationState("Accounts approval required before HR approval")
        row.status = SeparationStatus.HR_APPROVED.value

    def complete(self, row) -> None:
        if row.status != SeparationStatus.HR_APPROVED.value:
            raise InvalidSeparationState("HR approval required before completion")
        row.status = SeparationStatus.COMPLETED.value

    def cancel(self, row) -> None:
        if row.status == SeparationStatus.COMPLETED.value:
            raise InvalidSeparationState("Completed separation cannot be cancelled")
        row.status = SeparationStatus.CANCELLED.value
