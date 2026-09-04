"""ResourceAllocationService application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.project.models import PrjResourceAllocation
from modules.project.repository.resource_allocation_repository import ResourceAllocationRepository
from modules.project.service.engines import ResourceAllocationEngine
from modules.project.service.project_scope_validator import ProjectScopeValidator
from modules.project.service.project_assignment_scope import ProjectAssignmentScope


class ResourceAllocationService:
    def __init__(self, db: Session) -> None:
        self._repo = ResourceAllocationRepository(db)
        self._scope = ProjectScopeValidator(db)
        self._engine = ResourceAllocationEngine()
        self._audit = AuditService(db)
        self._assignment = ProjectAssignmentScope(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_rows(ctx, cid)
        return self._assignment.filter_project_child_rows(ctx, cid, rows)

    def get(self, ctx: TenantContext, row_id: UUID) -> PrjResourceAllocation:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("ResourceAllocationService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)

        row = self._repo.create(ctx, company_id=cid,  **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="prj_resource_allocation",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("ResourceAllocationService not found")
        return row
