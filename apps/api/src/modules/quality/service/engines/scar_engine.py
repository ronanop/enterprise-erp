"""SCAR lifecycle engine — independent of NCR status machine."""

from modules.quality.domain.enums import ScarStatus
from modules.quality.domain.exceptions import InvalidScarState
from modules.quality.models import QmScar


class ScarEngine:
    def validate_issuable(self, scar: QmScar) -> None:
        if scar.status != ScarStatus.DRAFT.value:
            raise InvalidScarState("Only draft SCARs can be issued")
        if not scar.vendor_id:
            raise InvalidScarState("Vendor is required to issue a SCAR")
        if not scar.description:
            raise InvalidScarState("Description is required to issue a SCAR")

    def validate_response(self, scar: QmScar, supplier_response: str | None) -> None:
        if scar.status != ScarStatus.ISSUED.value:
            raise InvalidScarState("Only issued SCARs can record a supplier response")
        if not supplier_response or not str(supplier_response).strip():
            raise InvalidScarState("Supplier response is required")

    def validate_verifiable(self, scar: QmScar) -> None:
        if scar.status != ScarStatus.RESPONDED.value:
            raise InvalidScarState("Only responded SCARs can be verified")

    def validate_closeable(self, scar: QmScar) -> None:
        if scar.status != ScarStatus.VERIFIED.value:
            raise InvalidScarState("Only verified SCARs can be closed")

    def apply_issue(self, scar: QmScar) -> None:
        self.validate_issuable(scar)
        scar.status = ScarStatus.ISSUED.value

    def apply_record_response(self, scar: QmScar, supplier_response: str) -> None:
        self.validate_response(scar, supplier_response)
        scar.supplier_response = supplier_response.strip()
        scar.status = ScarStatus.RESPONDED.value

    def apply_verify(self, scar: QmScar) -> None:
        self.validate_verifiable(scar)
        scar.status = ScarStatus.VERIFIED.value

    def apply_close(self, scar: QmScar) -> None:
        self.validate_closeable(scar)
        scar.status = ScarStatus.CLOSED.value
