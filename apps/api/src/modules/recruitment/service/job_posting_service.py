"""Job posting service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.recruitment.domain.enums import RecEntityType
from modules.recruitment.models import RecJobPosting
from modules.recruitment.repository.job_posting_repository import JobPostingRepository
from modules.recruitment.service.document_number_service import DocumentNumberService
from modules.recruitment.service.engines import JobPostingEngine
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator


class JobPostingService:
    def __init__(self, db: Session) -> None:
        self._repo = JobPostingRepository(db)
        self._scope = RecruitmentScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = JobPostingEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> RecJobPosting:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Job posting not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(RecEntityType.JOB_POSTING, cid, RecJobPosting, "document_number")
        return self._repo.create(ctx, company_id=cid, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Job posting not found")
        return row

    def publish(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.publish(row)
        return self._repo.update(ctx, row_id, status=row.status)
