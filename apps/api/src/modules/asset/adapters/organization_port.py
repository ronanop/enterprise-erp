"""Organization port — read organization hierarchy entities."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.models.hierarchy import OrgLocation
from modules.organization.repository.branch_repository import BranchRepository
from modules.organization.repository.hierarchy_repository import DepartmentRepository


class AssetOrganizationAdapter:
    def __init__(self, db: Session) -> None:
        self._branches = BranchRepository(db)
        self._departments = DepartmentRepository(db)

    def get_branch(self, ctx: TenantContext, branch_id: UUID):
        branch = self._branches.get_by_id(ctx, branch_id)
        if branch is None:
            raise NotFoundException("Branch not found")
        return branch

    def get_department(self, ctx: TenantContext, department_id: UUID):
        department = self._departments.get_by_id(ctx, department_id)
        if department is None:
            raise NotFoundException("Department not found")
        return department

    def get_location(self, ctx: TenantContext, location_id: UUID):
        stmt = select(OrgLocation).where(
            OrgLocation.id == location_id,
            OrgLocation.tenant_id == ctx.tenant_id,
            OrgLocation.is_deleted.is_(False),
        )
        row = self._departments.db.scalar(stmt)
        if row is None:
            raise NotFoundException("Organization location not found")
        return row
