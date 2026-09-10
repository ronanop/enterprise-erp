"""PPAP lifecycle engine — documentary approval only (no inventory posting)."""

from modules.quality.domain.enums import PpapStatus
from modules.quality.domain.exceptions import InvalidPpapState
from modules.quality.models import QmPpap


class PpapEngine:
    def validate_submittable(self, ppap: QmPpap) -> None:
        if ppap.status != PpapStatus.DRAFT.value:
            raise InvalidPpapState("Only draft PPAPs can be submitted")
        if not ppap.vendor_id or not ppap.product_id or not ppap.inspection_plan_id:
            raise InvalidPpapState("Vendor, product, and control plan are required")

    def validate_approvable(self, ppap: QmPpap) -> None:
        if ppap.status != PpapStatus.SUBMITTED.value:
            raise InvalidPpapState("Only submitted PPAPs can be approved")

    def validate_rejectable(self, ppap: QmPpap) -> None:
        if ppap.status != PpapStatus.SUBMITTED.value:
            raise InvalidPpapState("Only submitted PPAPs can be rejected")

    def validate_interim(self, ppap: QmPpap) -> None:
        if ppap.status != PpapStatus.SUBMITTED.value:
            raise InvalidPpapState("Only submitted PPAPs can be granted interim approval")

    def apply_submit(self, ppap: QmPpap) -> None:
        self.validate_submittable(ppap)
        ppap.status = PpapStatus.SUBMITTED.value

    def apply_approve(self, ppap: QmPpap) -> None:
        self.validate_approvable(ppap)
        ppap.status = PpapStatus.APPROVED.value

    def apply_reject(self, ppap: QmPpap) -> None:
        self.validate_rejectable(ppap)
        ppap.status = PpapStatus.REJECTED.value

    def apply_interim(self, ppap: QmPpap) -> None:
        self.validate_interim(ppap)
        ppap.status = PpapStatus.INTERIM.value
