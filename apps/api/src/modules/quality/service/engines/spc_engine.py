"""SPC capability and out-of-control evaluation."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from statistics import mean, stdev
from uuid import UUID

from modules.quality.domain.enums import Severity


SPC_WINDOW = 30
SPC_MIN_SAMPLES = 5
THREE_SIGMA = Decimal("3")


@dataclass
class SpcCapability:
    characteristic_id: UUID
    sample_count: int
    mean: Decimal | None
    stdev: Decimal | None
    lsl: Decimal | None
    usl: Decimal | None
    target: Decimal | None
    cp: Decimal | None
    cpk: Decimal | None


@dataclass
class SpcPointEvaluation:
    is_out_of_spec: bool
    is_out_of_control: bool
    severity: str
    reason: str


class SpcEngine:
    """Cp/Cpk and Western-Electric-lite OOC rules. Does not persist scores."""

    def compute_capability(
        self,
        characteristic_id: UUID,
        values: list[Decimal],
        *,
        min_value: Decimal | None,
        max_value: Decimal | None,
        target_value: Decimal | None,
    ) -> SpcCapability:
        nums = [Decimal(str(v)) for v in values]
        sample_count = len(nums)
        if sample_count == 0:
            return SpcCapability(
                characteristic_id=characteristic_id,
                sample_count=0,
                mean=None,
                stdev=None,
                lsl=min_value,
                usl=max_value,
                target=target_value,
                cp=None,
                cpk=None,
            )
        avg = Decimal(str(mean(nums)))
        sigma = self._stdev(nums)
        cp = None
        cpk = None
        if sigma is not None and sigma > 0 and min_value is not None and max_value is not None:
            six_sigma = sigma * Decimal("6")
            three_sigma = sigma * THREE_SIGMA
            spec_width = max_value - min_value
            if six_sigma > 0:
                cp = (spec_width / six_sigma).quantize(Decimal("0.0001"))
            if three_sigma > 0:
                cpu = (max_value - avg) / three_sigma
                cpl = (avg - min_value) / three_sigma
                cpk = min(cpu, cpl).quantize(Decimal("0.0001"))
        return SpcCapability(
            characteristic_id=characteristic_id,
            sample_count=sample_count,
            mean=avg.quantize(Decimal("0.0001")),
            stdev=sigma.quantize(Decimal("0.0001")) if sigma is not None else None,
            lsl=min_value,
            usl=max_value,
            target=target_value,
            cp=cp,
            cpk=cpk,
        )

    def evaluate_point(
        self,
        value: Decimal,
        *,
        min_value: Decimal | None,
        max_value: Decimal | None,
        target_value: Decimal | None,
        prior_values: list[Decimal],
    ) -> SpcPointEvaluation:
        value = Decimal(str(value))
        out_of_spec = False
        if min_value is not None and value < min_value:
            out_of_spec = True
        if max_value is not None and value > max_value:
            out_of_spec = True

        beyond_three_sigma = False
        if len(prior_values) >= SPC_MIN_SAMPLES:
            sigma = self._stdev(prior_values)
            avg = Decimal(str(mean(prior_values)))
            if sigma is not None and sigma > 0 and abs(value - avg) > THREE_SIGMA * sigma:
                beyond_three_sigma = True

        is_ooc = out_of_spec or beyond_three_sigma
        severity = Severity.MINOR.value
        reason = "in_control"
        if out_of_spec:
            severity = self._spec_severity(value, min_value, max_value, target_value)
            reason = "outside_spec_limit"
        elif beyond_three_sigma:
            severity = Severity.MINOR.value
            reason = "beyond_three_sigma"
        return SpcPointEvaluation(
            is_out_of_spec=out_of_spec,
            is_out_of_control=is_ooc,
            severity=severity,
            reason=reason,
        )

    def build_auto_ncr_kwargs(
        self,
        *,
        company_id: UUID,
        branch_id: UUID,
        reading_id: UUID,
        measured_value: Decimal,
        evaluation: SpcPointEvaluation,
        product_id: UUID | None,
        inprocess_inspection_id: UUID | None,
        incoming_inspection_id: UUID | None,
        final_inspection_id: UUID | None,
        characteristic_code: str | None,
    ) -> dict:
        """Kwargs for NcrService.create_ncr — uses existing source='in_process' only."""
        code = characteristic_code or str(reading_id)
        description = (
            f"SPC out of control ({evaluation.reason}) on characteristic {code}: "
            f"measured_value={measured_value}"
        )
        return {
            "company_id": company_id,
            "branch_id": branch_id,
            "source": "in_process",
            "severity": evaluation.severity,
            "description": description,
            "product_id": product_id,
            "incoming_inspection_id": incoming_inspection_id,
            "inprocess_inspection_id": inprocess_inspection_id,
            "final_inspection_id": final_inspection_id,
            "source_document_type": "spc_reading",
            "source_document_id": reading_id,
        }

    def _stdev(self, values: list[Decimal]) -> Decimal | None:
        if len(values) < 2:
            return None
        return Decimal(str(stdev([float(v) for v in values])))

    def _spec_severity(
        self,
        value: Decimal,
        min_value: Decimal | None,
        max_value: Decimal | None,
        target_value: Decimal | None,
    ) -> str:
        width = None
        if min_value is not None and max_value is not None:
            width = max_value - min_value
        overshoot = Decimal("0")
        if max_value is not None and value > max_value:
            overshoot = value - max_value
        elif min_value is not None and value < min_value:
            overshoot = min_value - value
        if width is not None and width > 0 and overshoot > width * Decimal("0.5"):
            return Severity.CRITICAL.value
        if target_value is not None and width is not None and width > 0:
            if abs(value - target_value) > width:
                return Severity.CRITICAL.value
        return Severity.MAJOR.value
