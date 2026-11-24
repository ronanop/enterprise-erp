"""Candidate service."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.foundation.domain.org_data_scope import effective_company_ids
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.models.branch import OrgBranch
from modules.recruitment.domain.enums import RecEntityType
from modules.recruitment.models import RecCandidate
from modules.recruitment.repository.base import RECRUITMENT_MODULE_KEY
from modules.recruitment.repository.candidate_repository import CandidateRepository
from modules.recruitment.service.document_number_service import DocumentNumberService
from modules.recruitment.service.engines import CandidateEngine
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator


class CandidateService:
    def __init__(self, db: Session) -> None:
        self._db = db
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

    def _resolve_create_company_id(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> UUID:
        """Creates need a concrete company_id (NOT NULL)."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        if cid is not None:
            return cid
        if branch_id is not None:
            branch = self._db.get(OrgBranch, branch_id)
            if branch is None or getattr(branch, "is_deleted", False):
                raise NotFoundException("Branch not found")
            if branch.company_id is None:
                raise ValidationException("Branch has no company; cannot create candidate")
            self._scope.validate_company_access(ctx, branch.company_id)
            return branch.company_id
        if ctx.company_id is not None:
            return ctx.company_id
        allowed = effective_company_ids(ctx, module_key=RECRUITMENT_MODULE_KEY)
        if allowed:
            return allowed[0]
        # Last resort: any active branch for this tenant
        branch = self._db.scalar(
            select(OrgBranch).where(
                OrgBranch.tenant_id == ctx.tenant_id,
                OrgBranch.is_deleted.is_(False),
            ).limit(1)
        )
        if branch is not None and branch.company_id is not None:
            return branch.company_id
        raise ValidationException("Company context required to create candidate")

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        branch_id = fields.pop("branch_id", None)
        cid = self._resolve_create_company_id(ctx, company_id=company_id, branch_id=branch_id)
        code = self._numbers.generate(
            RecEntityType.CANDIDATE,
            cid,
            RecCandidate,
            "candidate_code",
            tenant_id=ctx.tenant_id,
        )
        if not fields.get("full_name"):
            fields["full_name"] = f"{fields.get('first_name', '')} {fields.get('last_name', '')}".strip()
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            candidate_code=code,
            **fields,
        )

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Candidate not found")
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> str:
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Candidate not found")
        return "Candidate deleted"
