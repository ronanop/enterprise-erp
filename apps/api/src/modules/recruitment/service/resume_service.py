"""Resume application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.recruitment.models import RecResume
from modules.recruitment.repository.resume_repository import ResumeRepository
from modules.recruitment.service.engines import ResumeEngine
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator


class ResumeService:
    def __init__(self, db: Session) -> None:
        self._repo = ResumeRepository(db)
        self._scope = RecruitmentScopeValidator(db)
        self._engine = ResumeEngine()
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> RecResume:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Resume not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        if cid is None:
            raise ValidationException("Company context required to create resume")

        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="rec_resume",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Resume not found")
        return row
