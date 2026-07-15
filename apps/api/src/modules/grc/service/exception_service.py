"""ExceptionService."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.grc.domain.enums import GrcEntityType
from modules.grc.models import GrcException
from modules.grc.repository.exception_repository import ExceptionRepository
from modules.grc.service.engines import ExceptionEngine
from modules.grc.service.grc_number_service import GrcNumberService
from modules.grc.service.grc_scope_validator import GrcScopeValidator


class ExceptionService:
    def __init__(self, db: Session) -> None:
        self._repo = ExceptionRepository(db)
        self._scope = GrcScopeValidator(db)
        self._numbers = GrcNumberService(db)
        self._engine = ExceptionEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> GrcException:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("ExceptionService not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):

        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(GrcEntityType.EXCEPTION, cid, GrcException, "exception_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, exception_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("ExceptionService not found")
        return row

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)

