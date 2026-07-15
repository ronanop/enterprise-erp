"""Document domain entity markers."""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class DocumentIdentity:
    document_id: UUID
    document_number: str
    owner_employee_id: UUID
