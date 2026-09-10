"""Quality domain value objects / results."""

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID


@dataclass
class SpecCheckResult:
    characteristic_id: UUID
    is_out_of_spec: bool
    pass_fail: str


@dataclass
class DispositionQty:
    inspected_qty: Decimal
    accepted_qty: Decimal
    rejected_qty: Decimal

    def validate(self) -> bool:
        return (
            self.inspected_qty >= 0
            and self.accepted_qty >= 0
            and self.rejected_qty >= 0
            and (self.accepted_qty + self.rejected_qty) <= self.inspected_qty
        )

    def error_message(self) -> str:
        if self.inspected_qty < 0 or self.accepted_qty < 0 or self.rejected_qty < 0:
            return "Inspected, accepted, and rejected quantities must be zero or greater."
        if (self.accepted_qty + self.rejected_qty) > self.inspected_qty:
            return "Accepted plus rejected quantity cannot exceed inspected quantity."
        return "Invalid disposition quantities."


def normalize_pass_fail(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    normalized = str(value).strip().lower()
    if normalized not in {"pass", "fail", "na"}:
        raise ValueError("pass_fail must be pass, fail, or na")
    return normalized


@dataclass
class QualityKpiSnapshot:
    first_pass_yield: Decimal
    defect_rate: Decimal
    rework_rate: Decimal
    complaint_rate: Decimal
    supplier_quality_score: Decimal
