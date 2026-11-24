"""TalentPool application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.recruitment.models import RecTalentPool
from modules.recruitment.repository.talent_pool_repository import TalentPoolRepository
from modules.recruitment.service.engines import TalentPoolEngine
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator


class TalentPoolService:
    def __init__(self, db: Session) -> None:
        self._repo = TalentPoolRepository(db)
        self._scope = RecruitmentScopeValidator(db)
        self._engine = TalentPoolEngine()
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> RecTalentPool:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("TalentPool not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)

        row = self._repo.create(ctx, company_id=cid,  **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="rec_talent_pool",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("TalentPool not found")
        return row
