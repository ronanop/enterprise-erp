"""Repository for asset.ast_location / asset.ast_building."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.asset.models.site_building import AstBuilding
from modules.asset.models.site_location import AstLocation
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class SiteLocationRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstLocation | None:
        stmt = select(AstLocation).where(
            AstLocation.id == row_id,
            AstLocation.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstLocation, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def get_by_name(self, ctx: TenantContext, company_id: UUID, name: str) -> AstLocation | None:
        stmt = select(AstLocation).where(
            AstLocation.company_id == company_id,
            AstLocation.is_deleted.is_(False),
            func.lower(func.btrim(AstLocation.name)) == name.strip().lower(),
        )
        stmt = self.apply_ast_filter(stmt, AstLocation, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        search: str | None = None,
    ) -> list[AstLocation]:
        stmt = select(AstLocation).where(
            AstLocation.company_id == company_id,
            AstLocation.is_deleted.is_(False),
        )
        if search:
            term = f"%{search.strip()}%"
            stmt = stmt.where(AstLocation.name.ilike(term))
        stmt = self.apply_ast_filter(stmt, AstLocation, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt.order_by(AstLocation.name.asc())).all())

    def create(self, ctx: TenantContext, **fields) -> AstLocation:
        row = AstLocation(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row: AstLocation, **fields) -> AstLocation:
        for k, v in fields.items():
            setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row

    def soft_delete(self, ctx: TenantContext, row: AstLocation) -> None:
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()

    def count_buildings(self, ctx: TenantContext, location_id: UUID) -> int:
        stmt = select(func.count()).select_from(AstBuilding).where(
            AstBuilding.location_id == location_id,
            AstBuilding.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstBuilding, ctx, branch_scoped=False)
        return int(self.db.scalar(stmt) or 0)


class SiteBuildingRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstBuilding | None:
        stmt = select(AstBuilding).where(
            AstBuilding.id == row_id,
            AstBuilding.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstBuilding, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def get_by_name(
        self, ctx: TenantContext, location_id: UUID, name: str
    ) -> AstBuilding | None:
        stmt = select(AstBuilding).where(
            AstBuilding.location_id == location_id,
            AstBuilding.is_deleted.is_(False),
            func.lower(func.btrim(AstBuilding.name)) == name.strip().lower(),
        )
        stmt = self.apply_ast_filter(stmt, AstBuilding, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        location_id: UUID | None = None,
        search: str | None = None,
    ) -> list[AstBuilding]:
        stmt = select(AstBuilding).where(
            AstBuilding.company_id == company_id,
            AstBuilding.is_deleted.is_(False),
        )
        if location_id is not None:
            stmt = stmt.where(AstBuilding.location_id == location_id)
        if search:
            term = f"%{search.strip()}%"
            stmt = stmt.where(AstBuilding.name.ilike(term))
        stmt = self.apply_ast_filter(stmt, AstBuilding, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt.order_by(AstBuilding.name.asc())).all())

    def create(self, ctx: TenantContext, **fields) -> AstBuilding:
        row = AstBuilding(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row: AstBuilding, **fields) -> AstBuilding:
        for k, v in fields.items():
            setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row

    def soft_delete(self, ctx: TenantContext, row: AstBuilding) -> None:
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
