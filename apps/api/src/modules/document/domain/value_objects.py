"""Document value objects."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DocumentCodes:
    document_number: str
