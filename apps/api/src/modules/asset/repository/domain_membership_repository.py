"""Repository for asset.ast_domain_membership."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.asset.models.domain_membership import AstDomainMembership
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser


class DomainMembershipRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstDomainMembership | None:
        stmt = select(AstDomainMembership).where(
            AstDomainMembership.id == row_id,
            AstDomainMembership.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstDomainMembership, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def get_active(
        self,
        ctx: TenantContext,
        *,
        user_id: UUID,
        domain: str,
    ) -> AstDomainMembership | None:
        stmt = select(AstDomainMembership).where(
            AstDomainMembership.tenant_id == ctx.tenant_id,
            AstDomainMembership.user_id == user_id,
            AstDomainMembership.domain == domain,
            AstDomainMembership.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def list_rows(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        domain: str | None = None,
        user_id: UUID | None = None,
    ) -> list[AstDomainMembership]:
        stmt = select(AstDomainMembership).where(
            AstDomainMembership.tenant_id == ctx.tenant_id,
            AstDomainMembership.is_deleted.is_(False),
        )
        if company_id is not None:
            stmt = stmt.where(AstDomainMembership.company_id == company_id)
        if domain is not None:
            stmt = stmt.where(AstDomainMembership.domain == domain)
        if user_id is not None:
            stmt = stmt.where(AstDomainMembership.user_id == user_id)
        stmt = self.apply_ast_filter(stmt, AstDomainMembership, ctx, branch_scoped=False)
        return list(
            self.db.scalars(
                stmt.order_by(AstDomainMembership.domain.asc(), AstDomainMembership.assigned_at.desc())
            ).all()
        )

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        user_id: UUID,
        domain: str,
        role: str,
    ) -> AstDomainMembership:
        now = utcnow()
        row = AstDomainMembership(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            user_id=user_id,
            domain=domain,
            role=role,
            assigned_at=now,
            assigned_by=ctx.user_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_role(
        self,
        ctx: TenantContext,
        row: AstDomainMembership,
        role: str,
    ) -> AstDomainMembership:
        row.role = role
        row.assigned_at = utcnow()
        row.assigned_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row

    def soft_delete(self, ctx: TenantContext, row: AstDomainMembership) -> None:
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()

    def list_assignable_users(self, ctx: TenantContext) -> list[SecUser]:
        stmt = (
            select(SecUser)
            .where(
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
                SecUser.status == "active",
            )
            .order_by(SecUser.display_name.asc())
        )
        return list(self.db.scalars(stmt).all())

    def users_by_ids(self, tenant_id: UUID, user_ids: list[UUID]) -> dict[UUID, SecUser]:
        if not user_ids:
            return {}
        stmt = select(SecUser).where(
            SecUser.tenant_id == tenant_id,
            SecUser.id.in_(user_ids),
            SecUser.is_deleted.is_(False),
        )
        return {u.id: u for u in self.db.scalars(stmt).all()}
