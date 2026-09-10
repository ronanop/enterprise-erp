"""Warranty claim lifecycle — separate from complaint KPI and finance posting."""

from modules.quality.domain.enums import WarrantyClaimStatus
from modules.quality.domain.exceptions import InvalidWarrantyClaimState
from modules.quality.models import QmWarrantyClaim

_CLOSEABLE = {
    WarrantyClaimStatus.INVESTIGATING.value,
    WarrantyClaimStatus.ACCEPTED.value,
    WarrantyClaimStatus.REJECTED.value,
    WarrantyClaimStatus.CAPA_LINKED.value,
}

_LINKABLE = {
    WarrantyClaimStatus.INVESTIGATING.value,
    WarrantyClaimStatus.ACCEPTED.value,
}

_PATCH_STATUSES = {
    WarrantyClaimStatus.ACCEPTED.value,
    WarrantyClaimStatus.REJECTED.value,
    WarrantyClaimStatus.CANCELLED.value,
}


class WarrantyEngine:
    def validate_investigable(self, claim: QmWarrantyClaim) -> None:
        if claim.status != WarrantyClaimStatus.DRAFT.value:
            raise InvalidWarrantyClaimState("Only draft warranty claims can start investigation")

    def validate_linkable(self, claim: QmWarrantyClaim) -> None:
        if claim.status not in _LINKABLE:
            raise InvalidWarrantyClaimState("CAPA can only be linked from investigating or accepted")

    def validate_closable(self, claim: QmWarrantyClaim) -> None:
        if claim.status not in _CLOSEABLE:
            raise InvalidWarrantyClaimState("Warranty claim cannot be closed from current status")

    def apply_investigate(self, claim: QmWarrantyClaim) -> None:
        self.validate_investigable(claim)
        claim.status = WarrantyClaimStatus.INVESTIGATING.value

    def apply_link_capa(self, claim: QmWarrantyClaim) -> None:
        self.validate_linkable(claim)
        claim.status = WarrantyClaimStatus.CAPA_LINKED.value

    def apply_close(self, claim: QmWarrantyClaim) -> None:
        self.validate_closable(claim)
        claim.status = WarrantyClaimStatus.CLOSED.value

    def apply_status(self, claim: QmWarrantyClaim, new_status: str) -> None:
        target = new_status.strip().lower()
        if target not in _PATCH_STATUSES:
            raise InvalidWarrantyClaimState("Status can only be patched to accepted, rejected, or cancelled")
        if target == WarrantyClaimStatus.CANCELLED.value:
            if claim.status != WarrantyClaimStatus.DRAFT.value:
                raise InvalidWarrantyClaimState("Only draft warranty claims can be cancelled")
            claim.status = WarrantyClaimStatus.CANCELLED.value
            return
        if claim.status != WarrantyClaimStatus.INVESTIGATING.value:
            raise InvalidWarrantyClaimState("Only investigating claims can be accepted or rejected")
        claim.status = target
