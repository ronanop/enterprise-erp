"""Organization repository base utilities."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.value_objects import TenantContext


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class OrgScopedRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def apply_tenant_filter(stmt, model, ctx: TenantContext):
        stmt = stmt.where(model.tenant_id == ctx.tenant_id)
        if hasattr(model, "is_deleted"):
            stmt = stmt.where(model.is_deleted.is_(False))
        return stmt

    @staticmethod
    def ensure_company_access(ctx: TenantContext, company_id: UUID) -> None:
        if ctx.user_type in {"super_admin", "tenant_admin"}:
            return
        if ctx.company_id and ctx.company_id != company_id:
            raise ForbiddenException("Company scope mismatch")

    @staticmethod
    def ensure_branch_access(ctx: TenantContext, branch_id: UUID) -> None:
        if ctx.user_type in {"super_admin", "tenant_admin"}:
            return
        if ctx.branch_id and ctx.branch_id != branch_id:
            raise ForbiddenException("Branch scope mismatch")
