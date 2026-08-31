"""Designation application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.models import HrDesignation
from modules.hr.repository.designation_repository import DesignationRepository
from modules.hr.service.engines import DesignationEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator


class DesignationService:
    def __init__(self, db: Session) -> None:
        self._repo = DesignationRepository(db)
        self._scope = HrScopeValidator(db)
        self._engine = DesignationEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrDesignation:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Designation not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_designation",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Designation not found")
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Designation not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_designation",
            entity_id=row_id,
            operation="delete",
            performed_by=ctx.user_id,
        )
