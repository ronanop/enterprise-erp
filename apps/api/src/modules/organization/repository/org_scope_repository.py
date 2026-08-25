"""User organization scope repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUserOrgScope
from modules.organization.repository.base import utcnow


class OrgScopeRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_user_scopes(self, user_id: UUID, tenant_id: UUID) -> list[SecUserOrgScope]:
        stmt = select(SecUserOrgScope).where(
            SecUserOrgScope.user_id == user_id,
            SecUserOrgScope.tenant_id == tenant_id,
        )
        return list(self.db.scalars(stmt).all())

    def get_default_scope(self, user_id: UUID, tenant_id: UUID) -> SecUserOrgScope | None:
        stmt = select(SecUserOrgScope).where(
            SecUserOrgScope.user_id == user_id,
            SecUserOrgScope.tenant_id == tenant_id,
            SecUserOrgScope.is_default.is_(True),
        )
        return self.db.scalar(stmt)

    def user_has_company_access(self, ctx: TenantContext, company_id: UUID) -> bool:
        if ctx.user_type in {"super_admin", "tenant_admin"}:
            return True
        stmt = select(SecUserOrgScope).where(
            SecUserOrgScope.user_id == ctx.user_id,
            SecUserOrgScope.tenant_id == ctx.tenant_id,
            SecUserOrgScope.company_id == company_id,
        )
        return self.db.scalar(stmt) is not None

    def user_has_branch_access(self, ctx: TenantContext, branch_id: UUID) -> bool:
        if ctx.user_type in {"super_admin", "tenant_admin", "company_admin"}:
            return True
        # Explicit assignment to this branch
        stmt = select(SecUserOrgScope).where(
            SecUserOrgScope.user_id == ctx.user_id,
            SecUserOrgScope.tenant_id == ctx.tenant_id,
            SecUserOrgScope.branch_id == branch_id,
        )
        if self.db.scalar(stmt) is not None:
            return True
        # Company-scoped users (e.g. HR with TENANT_ADMIN role, user_type=employee)
        # may manage every branch under companies they already have access to.
        from modules.organization.models.branch import OrgBranch

        branch = self.db.scalar(
            select(OrgBranch).where(
                OrgBranch.id == branch_id,
                OrgBranch.tenant_id == ctx.tenant_id,
                OrgBranch.is_deleted.is_(False),
            )
        )
        if branch is None:
            return False
        return self.user_has_company_access(ctx, branch.company_id)

    def assign_scope(
        self,
        ctx: TenantContext,
        *,
        user_id: UUID,
        company_id: UUID,
        branch_id: UUID | None = None,
        is_default: bool = False,
    ) -> SecUserOrgScope:
        row = SecUserOrgScope(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            user_id=user_id,
            company_id=company_id,
            branch_id=branch_id,
            is_default=is_default,
            assigned_at=utcnow(),
            assigned_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return row
