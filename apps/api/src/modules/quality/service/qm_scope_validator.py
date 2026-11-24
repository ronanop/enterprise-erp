"""Quality scope validator."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.value_objects import TenantContext
from modules.quality.repository.base import MODULE_KEY, QmScopedRepository


class QmScopeValidator:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_list_company_id(
        self, ctx: TenantContext, company_id: UUID | None
    ) -> UUID | None:
        return QmScopedRepository.resolve_list_company_id(ctx, company_id)

    def resolve_company_id(self, ctx: TenantContext, company_id: UUID | None) -> UUID:
        return QmScopedRepository.resolve_company_id(ctx, company_id)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        QmScopedRepository.ensure_company_access(
            ctx, company_id, module_key=MODULE_KEY
        )

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID | None) -> None:
        # Session branch must not block cross-entity quality work.
        _ = (ctx, branch_id)

    def require_branch(self, ctx: TenantContext, branch_id: UUID | None) -> UUID:
        if branch_id is not None:
            self.validate_branch_access(ctx, branch_id)
            return branch_id
        if ctx.branch_id is None:
            raise ForbiddenException("Branch context required")
        return ctx.branch_id
