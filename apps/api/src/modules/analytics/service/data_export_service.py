"""DataExportService."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.analytics.domain.enums import AnalyticsEntityType
from modules.analytics.models import BiDataExport
from modules.analytics.repository.data_export_repository import DataExportRepository
from modules.analytics.service.analytics_number_service import AnalyticsNumberService
from modules.analytics.service.analytics_scope_validator import AnalyticsScopeValidator
from modules.analytics.service.engines import DataExportEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class DataExportService:
    def __init__(self, db: Session) -> None:
        self._repo = DataExportRepository(db)
        self._scope = AnalyticsScopeValidator(db)
        self._numbers = AnalyticsNumberService(db)
        self._engine = DataExportEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> BiDataExport:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("DataExportService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(AnalyticsEntityType.EXPORT, cid, BiDataExport, "export_number")
        return self._repo.create(ctx, company_id=cid, export_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("DataExportService not found")
        return row

    def run(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.run(row)
        return self._repo.update(ctx, row_id, status=row.status)

