"""Sampling accept/reject engine."""

from modules.quality.domain.exceptions import InvalidSamplingPlan
from modules.quality.models import QmSamplingPlan


class SamplingEngine:
    def validate_accept_reject(
        self,
        sampling_plan: QmSamplingPlan,
        *,
        defect_count: int,
    ) -> str:
        if defect_count < 0:
            raise InvalidSamplingPlan("Defect count cannot be negative")
        if defect_count <= sampling_plan.accept_count:
            return "accept"
        if defect_count >= sampling_plan.reject_count:
            return "reject"
        raise InvalidSamplingPlan("Defect count in indeterminate zone")
