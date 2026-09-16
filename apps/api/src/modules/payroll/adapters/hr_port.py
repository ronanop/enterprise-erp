"""HR port - wraps HRIntegrationService payroll read facts."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.service.integration_service import HRIntegrationService


class PayrollHrAdapter:
    def __init__(self, db: Session) -> None:
        self._hr = HRIntegrationService(db)

    def employment_facts(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        return self._hr.payroll_employment_facts(ctx, company_id)

    def attendance_facts(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        return self._hr.payroll_attendance_facts(ctx, company_id)

    def leave_facts(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        return self._hr.payroll_leave_facts(ctx, company_id)
