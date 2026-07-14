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


@dataclass
class QualityKpiSnapshot:
    first_pass_yield: Decimal
    defect_rate: Decimal
    rework_rate: Decimal
    complaint_rate: Decimal
    supplier_quality_score: Decimal
