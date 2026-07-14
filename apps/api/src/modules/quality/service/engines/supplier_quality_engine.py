"""Supplier quality scorecard engine."""

from modules.quality.domain.enums import PublishStatus
from modules.quality.domain.exceptions import InvalidScoreState
from modules.quality.models import QmSupplierQuality


class SupplierQualityEngine:
    def validate_publishable(self, score: QmSupplierQuality) -> None:
        if score.status != PublishStatus.DRAFT.value:
            raise InvalidScoreState("Only draft scorecards can be published")
        if score.vendor_id is None:
            raise InvalidScoreState("Vendor is required")
        if score.score_period_start is None or score.score_period_end is None:
            raise InvalidScoreState("Score period is required")
        if score.score_period_end < score.score_period_start:
            raise InvalidScoreState("Score period end must be on or after start")
