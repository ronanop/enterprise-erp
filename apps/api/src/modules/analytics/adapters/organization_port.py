"""Organization port — read org_department only."""

from collections import Counter
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.employee_service import EmployeeService
from modules.organization.repository.hierarchy_repository import DepartmentRepository

_HEADCOUNT_STATUSES = frozenset(
    {"active", "probation", "onboarding", "on_leave", "notice_period"}
)


class AnalyticsOrganizationAdapter:
    def __init__(self, db: Session) -> None:
        self._departments = DepartmentRepository(db)
        self._employees = EmployeeService(db)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        row = self._departments.get_by_id(ctx, department_id)
        if row is None:
            raise NotFoundException("Department not found")
        return row

    def headcount_by_department(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        departments = self._departments.list_departments(ctx, company_id=company_id)
        names = {d.id: d.department_name for d in departments}
        employees = self._employees.list_employees(ctx, company_id=company_id)
        counts: Counter[UUID | None] = Counter()
        for emp in employees:
            if getattr(emp, "status", None) not in _HEADCOUNT_STATUSES:
                continue
            counts[getattr(emp, "department_id", None)] += 1
        breakdown: list[dict[str, str | int]] = []
        for dept in departments:
            breakdown.append(
                {"dimension_label": dept.department_name, "value": int(counts.get(dept.id, 0))}
            )
        unknown = int(counts.get(None, 0))
        extra_ids = [did for did in counts if did is not None and did not in names]
        for did in extra_ids:
            breakdown.append({"dimension_label": "Unassigned", "value": int(counts[did])})
        if unknown:
            breakdown.append({"dimension_label": "Unassigned", "value": unknown})
        total = sum(int(item["value"]) for item in breakdown)
        return total, breakdown
