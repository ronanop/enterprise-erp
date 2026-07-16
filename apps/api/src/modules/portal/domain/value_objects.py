"""Customer Portal value objects."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PortalCodes:
    document_number: str
