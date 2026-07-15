"""Organization port — read org_department only."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.hierarchy_repository import DepartmentRepository


class HelpdeskOrganizationAdapter:
    def __init__(self, db: Session) -> None:
        self._departments = DepartmentRepository(db)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        department = self._departments.get_by_id(ctx, department_id)
        if department is None:
            raise NotFoundException("Department not found")
        return department
