"""ServiceRequestService."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.portal.domain.enums import PortalEntityType
from modules.portal.models import PtServiceRequest
from modules.portal.repository.service_request_repository import ServiceRequestRepository
from modules.portal.service.engines import ServiceRequestEngine
from modules.portal.service.portal_number_service import PortalNumberService
from modules.portal.service.portal_scope_validator import PortalScopeValidator


class ServiceRequestService:
    def __init__(self, db: Session) -> None:
        self._repo = ServiceRequestRepository(db)
        self._scope = PortalScopeValidator(db)
        self._numbers = PortalNumberService(db)
        self._engine = ServiceRequestEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PtServiceRequest:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("ServiceRequestService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(PortalEntityType.SERVICE_REQUEST, cid, PtServiceRequest, "request_number")
        return self._repo.create(ctx, company_id=cid, request_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("ServiceRequestService not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

