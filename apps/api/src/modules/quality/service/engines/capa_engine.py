"""CAPA lifecycle engine."""

from datetime import datetime, timezone

from modules.quality.domain.enums import ActionStatus, CapaStatus, CapaType
from modules.quality.domain.exceptions import InvalidCapaState
from modules.quality.models import QmCapa


class CapaEngine:
    def validate_submittable(self, capa: QmCapa) -> None:
        if capa.status != CapaStatus.DRAFT.value:
            raise InvalidCapaState("Only draft CAPAs can be submitted")
        if capa.ncr_id is None:
            raise InvalidCapaState("CAPA must be linked to an NCR")

    def validate_approvable(self, capa: QmCapa) -> None:
        if capa.status != CapaStatus.SUBMITTED.value:
            raise InvalidCapaState("Only submitted CAPAs can be approved")
        if capa.capa_type == CapaType.CORRECTIVE.value and not capa.corrective_actions:
            raise InvalidCapaState("Corrective CAPA requires at least one corrective action")
        if capa.capa_type == CapaType.PREVENTIVE.value and not capa.preventive_actions:
            raise InvalidCapaState("Preventive CAPA requires at least one preventive action")
        if capa.capa_type == CapaType.BOTH.value and (
            not capa.corrective_actions or not capa.preventive_actions
        ):
            raise InvalidCapaState("Both-type CAPA requires corrective and preventive actions")

    def validate_verifiable(self, capa: QmCapa) -> None:
        if capa.status != CapaStatus.IN_PROGRESS.value:
            raise InvalidCapaState("Only in-progress CAPAs can be verified")
        actions = list(capa.corrective_actions) + list(capa.preventive_actions)
        if actions and any(a.status != ActionStatus.DONE.value for a in actions):
            raise InvalidCapaState("All actions must be done before verification")

    def validate_closeable(self, capa: QmCapa) -> None:
        if capa.status != CapaStatus.VERIFIED.value:
            raise InvalidCapaState("Only verified CAPAs can be closed")

    def apply_submit(self, capa: QmCapa) -> None:
        self.validate_submittable(capa)
        capa.status = CapaStatus.SUBMITTED.value

    def apply_approve(self, capa: QmCapa) -> None:
        self.validate_approvable(capa)
        capa.status = CapaStatus.IN_PROGRESS.value

    def apply_verify(self, capa: QmCapa) -> None:
        self.validate_verifiable(capa)
        capa.status = CapaStatus.VERIFIED.value
        capa.verified_at = datetime.now(timezone.utc)

    def apply_close(self, capa: QmCapa) -> None:
        self.validate_closeable(capa)
        capa.status = CapaStatus.CLOSED.value
