"""GrcReportService."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.grc.domain.enums import GrcEntityType
from modules.grc.models import GrcReport
from modules.grc.repository.report_repository import ReportRepository
from modules.grc.service.engines import ReportEngine
from modules.grc.service.grc_number_service import GrcNumberService
from modules.grc.service.grc_scope_validator import GrcScopeValidator


class GrcReportService:
    def __init__(self, db: Session) -> None:
        self._repo = ReportRepository(db)
        self._scope = GrcScopeValidator(db)
        self._numbers = GrcNumberService(db)
        self._engine = ReportEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> GrcReport:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("GrcReportService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):

        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(GrcEntityType.REPORT, cid, GrcReport, "report_code")
        return self._repo.create(ctx, company_id=cid, report_code=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("GrcReportService not found")
        return row

    def finalize(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.finalize(row)
        return self._repo.update(ctx, row_id, status=row.status)

