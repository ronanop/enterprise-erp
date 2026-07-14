"""CRM domain entity markers (DDD identity)."""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class LeadEntity:
    id: UUID
    lead_code: str
    status: str


@dataclass
class OpportunityEntity:
    id: UUID
    opportunity_code: str
    status: str
    current_stage: str
