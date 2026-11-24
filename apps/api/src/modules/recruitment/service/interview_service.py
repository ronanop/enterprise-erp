"""Interview service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.recruitment.domain.enums import RecEntityType
from modules.recruitment.models import RecInterview
from modules.recruitment.repository.interview_repository import InterviewRepository
from modules.recruitment.service.document_number_service import DocumentNumberService
from modules.recruitment.service.engines import InterviewEngine
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator


class InterviewService:
    def __init__(self, db: Session) -> None:
        self._repo = InterviewRepository(db)
        self._scope = RecruitmentScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = InterviewEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> RecInterview:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Interview not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(RecEntityType.INTERVIEW, cid, RecInterview, "document_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Interview not found")
        return row

    def schedule(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.schedule(row)
        return self._repo.update(ctx, row_id, status=row.status, result=row.result)

    def complete(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.complete(row)
        return self._repo.update(ctx, row_id, status=row.status)
