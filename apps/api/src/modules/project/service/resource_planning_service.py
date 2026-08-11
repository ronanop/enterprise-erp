"""ResourcePlanningService."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.project.domain.enums import PrjEntityType
from modules.project.models import PrjResourcePlan
from modules.project.repository.resource_plan_repository import ResourcePlanRepository
from modules.project.service.document_number_service import DocumentNumberService
from modules.project.service.engines import ResourcePlanEngine
from modules.project.service.project_scope_validator import ProjectScopeValidator
from modules.project.service.project_assignment_scope import ProjectAssignmentScope


class ResourcePlanningService:
    def __init__(self, db: Session) -> None:
        self._repo = ResourcePlanRepository(db)
        self._scope = ProjectScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ResourcePlanEngine()
        self._audit = AuditService(db)
        self._assignment = ProjectAssignmentScope(db)
        self._db = db

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_rows(ctx, cid)
        return self._assignment.filter_project_child_rows(ctx, cid, rows)

    def get(self, ctx: TenantContext, row_id: UUID) -> PrjResourcePlan:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("ResourcePlanningService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):

        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(PrjEntityType.RESOURCE_PLAN, cid, PrjResourcePlan, "document_number")
        return self._repo.create(ctx, company_id=cid, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("ResourcePlanningService not found")
        return row

    def activate(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.activate(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def close(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.close(row)
        return self._repo.update(ctx, row_id, status=row.status)

