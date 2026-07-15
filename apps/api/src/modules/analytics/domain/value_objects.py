"""Analytics value objects."""

from dataclasses import dataclass


@dataclass(frozen=True)
class AnalyticsCodes:
    document_number: str
