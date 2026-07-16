"""InvoiceViewService application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.portal.models import PtInvoiceView
from modules.portal.repository.invoice_view_repository import InvoiceViewRepository
from modules.portal.service.engines import InvoiceViewEngine
from modules.portal.service.portal_scope_validator import PortalScopeValidator


class InvoiceViewService:
    def __init__(self, db: Session) -> None:
        self._repo = InvoiceViewRepository(db)
        self._scope = PortalScopeValidator(db)
        self._engine = InvoiceViewEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PtInvoiceView:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("InvoiceViewService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pt_invoice_view",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("InvoiceViewService not found")
        return row
