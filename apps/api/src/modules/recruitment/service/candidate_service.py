"""Candidate service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.recruitment.domain.enums import RecEntityType
from modules.recruitment.models import RecCandidate
from modules.recruitment.repository.candidate_repository import CandidateRepository
from modules.recruitment.service.document_number_service import DocumentNumberService
from modules.recruitment.service.engines import CandidateEngine
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator


class CandidateService:
    def __init__(self, db: Session) -> None:
        self._repo = CandidateRepository(db)
        self._scope = RecruitmentScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = CandidateEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> RecCandidate:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Candidate not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = self._numbers.generate(RecEntityType.CANDIDATE, cid, RecCandidate, "candidate_code")
        if not fields.get("full_name"):
            fields["full_name"] = f"{fields.get('first_name', '')} {fields.get('last_name', '')}".strip()
        return self._repo.create(ctx, company_id=cid, candidate_code=code, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Candidate not found")
        return row
