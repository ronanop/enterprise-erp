"""Analytics domain entity markers."""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class DashboardIdentity:
    dashboard_id: UUID
    dashboard_number: str
    owner_employee_id: UUID
