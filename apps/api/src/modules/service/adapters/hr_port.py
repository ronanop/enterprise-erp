"""HR / HRMS port for Service — shift-roster duty visibility.

Service must not import HR ORM models. When HRMS roster merge is complete and
SERVICE_ROSTER_VISIBILITY_ENABLED=true, ticket queues only include people
currently on duty for the active shift.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from core.config import settings
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.service.integration_service import HRIntegrationService


class ServiceHrAdapter:
    def __init__(self, db: Session) -> None:
        self._hr = HRIntegrationService(db)

    @property
    def roster_visibility_enabled(self) -> bool:
        return bool(settings.service_roster_visibility_enabled)

    def list_on_duty_employee_ids(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        at: datetime | None = None,
    ) -> set[UUID]:
        if not self.roster_visibility_enabled:
            return set()
        return self._hr.list_on_duty_employee_ids(ctx, company_id=company_id, at=at)

    def list_on_duty_employee_ids_for_reminders(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        at: datetime | None = None,
    ) -> set[UUID]:
        """Always resolve live published duty — used by unopened-ticket roster pings."""
        if not bool(settings.service_roster_open_reminder_enabled):
            return set()
        return self._hr.list_on_duty_employee_ids(ctx, company_id=company_id, at=at)

    def is_employee_on_duty(
        self,
        ctx: TenantContext,
        employee_id: UUID | None,
        *,
        company_id: UUID | None = None,
        at: datetime | None = None,
    ) -> bool:
        if not self.roster_visibility_enabled:
            # Gate off → treat everyone as eligible (current ERP behavior).
            return True
        if employee_id is None:
            return False
        return self._hr.is_employee_on_duty(ctx, employee_id, company_id=company_id, at=at)
