"""Defect lifecycle engine."""

from modules.quality.domain.enums import DefectStatus
from modules.quality.domain.exceptions import InvalidDefectState
from modules.quality.models import QmDefect


class DefectEngine:
    def validate_linkable_to_ncr(self, defect: QmDefect) -> None:
        if defect.status != DefectStatus.OPEN.value:
            raise InvalidDefectState("Only open defects can be linked to NCR")
        if defect.ncr_id is not None:
            raise InvalidDefectState("Defect is already linked to an NCR")
