"""HR port - employment request via EmploymentService; no hr_* ORM writes."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.service.designation_service import DesignationService
from modules.hr.service.employment_service import EmploymentService


class RecruitmentHrAdapter:
    def __init__(self, db: Session) -> None:
        self._employment = EmploymentService(db)
        self._designations = DesignationService(db)

    def create_employment(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        company_id: UUID | None = None,
        employment_type: str = "permanent",
        date_of_joining: date | None = None,
        **fields,
    ):
        """Request HR employment via service only - never write hr_* ORM from recruitment."""
        payload = dict(fields)
        payload.setdefault("employment_type", employment_type)
        if date_of_joining is not None:
            payload["date_of_joining"] = date_of_joining
        return self._employment.create(
            ctx,
            branch_id=branch_id,
            employee_id=employee_id,
            company_id=company_id,
            **payload,
        )

    def get_designation(self, ctx: TenantContext, designation_id: UUID):
        return self._designations.get(ctx, designation_id)
