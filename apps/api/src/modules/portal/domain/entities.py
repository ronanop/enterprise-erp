"""Customer Portal domain entity markers."""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class PortalAccountIdentity:
    account_id: UUID
    account_number: str
