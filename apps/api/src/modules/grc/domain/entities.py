"""GRC domain entity markers."""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class PolicyIdentity:
    policy_id: UUID
    policy_number: str
    owner_employee_id: UUID
