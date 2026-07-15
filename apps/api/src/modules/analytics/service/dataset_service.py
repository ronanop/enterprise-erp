"""DatasetService."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.analytics.domain.enums import AnalyticsEntityType
from modules.analytics.models import BiDataset
from modules.analytics.repository.dataset_repository import DatasetRepository
from modules.analytics.service.analytics_number_service import AnalyticsNumberService
from modules.analytics.service.analytics_scope_validator import AnalyticsScopeValidator
from modules.analytics.service.engines import DatasetEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class DatasetService:
    def __init__(self, db: Session) -> None:
        self._repo = DatasetRepository(db)
        self._scope = AnalyticsScopeValidator(db)
        self._numbers = AnalyticsNumberService(db)
        self._engine = DatasetEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> BiDataset:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("DatasetService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(AnalyticsEntityType.DATASET, cid, BiDataset, "dataset_number")
        return self._repo.create(ctx, company_id=cid, dataset_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("DatasetService not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def refresh(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.refresh(row)
        return self._repo.update(ctx, row_id, status=row.status)

