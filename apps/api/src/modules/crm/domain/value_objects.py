"""CRM value objects."""

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class ForecastAmount:
    expected_revenue: Decimal
    probability_percent: Decimal

    @property
    def amount(self) -> Decimal:
        return (self.expected_revenue * self.probability_percent / Decimal("100")).quantize(
            Decimal("0.0001")
        )
