"""AuditPlanService application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.grc.models import GrcAuditPlan
from modules.grc.repository.audit_plan_repository import AuditPlanRepository
from modules.grc.service.engines import AuditPlanEngine
from modules.grc.service.grc_scope_validator import GrcScopeValidator


class AuditPlanService:
    def __init__(self, db: Session) -> None:
        self._repo = AuditPlanRepository(db)
        self._scope = GrcScopeValidator(db)
        self._engine = AuditPlanEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> GrcAuditPlan:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("AuditPlanService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)

        row = self._repo.create(ctx, company_id=cid,  **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="grc_audit_plan",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("AuditPlanService not found")
        return row
