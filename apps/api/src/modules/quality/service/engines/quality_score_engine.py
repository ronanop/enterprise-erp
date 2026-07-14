"""Quality KPI score engine."""

from decimal import Decimal

from modules.quality.domain.entities import QualityKpiSnapshot
from modules.quality.domain.enums import PublishStatus
from modules.quality.domain.exceptions import InvalidScoreState
from modules.quality.models import QmQualityScore


class QualityScoreEngine:
    def validate_publishable(self, score: QmQualityScore) -> None:
        if score.status != PublishStatus.DRAFT.value:
            raise InvalidScoreState("Only draft scores can be published")
        if score.period_start is None or score.period_end is None:
            raise InvalidScoreState("Score period is required")
        if score.period_end < score.period_start:
            raise InvalidScoreState("Period end must be on or after start")

    def compute_kpis(self, counts: dict) -> QualityKpiSnapshot:
        inspected = Decimal(str(counts.get("inspected", 0)))
        passed = Decimal(str(counts.get("passed", 0)))
        defects = Decimal(str(counts.get("defects", 0)))
        rework = Decimal(str(counts.get("rework", 0)))
        complaints = Decimal(str(counts.get("complaints", 0)))
        supplier_scores = Decimal(str(counts.get("supplier_scores", 0)))
        supplier_count = Decimal(str(counts.get("supplier_count", 1)))

        fpy = (passed / inspected * 100).quantize(Decimal("0.0001")) if inspected > 0 else Decimal("0")
        defect_rate = (defects / inspected * 100).quantize(Decimal("0.0001")) if inspected > 0 else Decimal("0")
        rework_rate = (rework / inspected * 100).quantize(Decimal("0.0001")) if inspected > 0 else Decimal("0")
        complaint_rate = complaints.quantize(Decimal("0.0001"))
        supplier_quality = (
            (supplier_scores / supplier_count).quantize(Decimal("0.0001"))
            if supplier_count > 0
            else Decimal("0")
        )
        return QualityKpiSnapshot(
            first_pass_yield=fpy,
            defect_rate=defect_rate,
            rework_rate=rework_rate,
            complaint_rate=complaint_rate,
            supplier_quality_score=supplier_quality,
        )
