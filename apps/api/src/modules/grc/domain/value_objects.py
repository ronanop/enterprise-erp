"""GRC value objects."""

from dataclasses import dataclass


@dataclass(frozen=True)
class GrcCodes:
    document_number: str
