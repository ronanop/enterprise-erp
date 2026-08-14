"""Asset component repository (FP-ASSET-019).

Depth-1 hierarchy: queries by parent asset_id only (no recursion).
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.domain.enums import AssetComponentStatus
from modules.asset.models import AstAsset, AstAssetComponent
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

SORT_COLUMNS = {
    "created_at": AstAssetComponent.created_at,
    "component_code": AstAssetComponent.component_code,
    "component_name": AstAssetComponent.component_name,
}


@dataclass(frozen=True)
class AssetComponentListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    status: str | None = None
    product_id: UUID | None = None
    branch_id: UUID | None = None
    search: str | None = None
    sort: str = "created_at"


class AssetComponentRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetComponent | None:
        stmt = select(AstAssetComponent).where(
            AstAssetComponent.id == row_id,
            AstAssetComponent.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetComponent, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetComponentListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetComponentListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetComponent], int]:
        stmt = select(AstAssetComponent).where(
            AstAssetComponent.company_id == filters.company_id,
            AstAssetComponent.is_deleted.is_(False),
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetComponent.asset_id == filters.asset_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetComponent.status == filters.status)
        if filters.product_id is not None:
            stmt = stmt.where(AstAssetComponent.product_id == filters.product_id)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetComponent.branch_id == filters.branch_id)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetComponent.component_code.ilike(term),
                    AstAssetComponent.component_name.ilike(term),
                    AstAssetComponent.serial_number.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetComponent, ctx, branch_scoped=False)
        total = int(self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
        sort_col = SORT_COLUMNS.get(filters.sort, AstAssetComponent.created_at)
        rows = list(
            self.db.scalars(stmt.order_by(sort_col.desc()).offset(offset).limit(limit)).all()
        )
        return rows, total

    def list_by_asset(
        self, ctx: TenantContext, asset_id: UUID, *, include_inactive: bool = True
    ) -> list[AstAssetComponent]:
        stmt = select(AstAssetComponent).where(
            AstAssetComponent.asset_id == asset_id,
            AstAssetComponent.is_deleted.is_(False),
        )
        if not include_inactive:
            stmt = stmt.where(AstAssetComponent.status == AssetComponentStatus.ACTIVE.value)
        stmt = self.apply_ast_filter(stmt, AstAssetComponent, ctx, branch_scoped=False)
        return list(
            self.db.scalars(stmt.order_by(AstAssetComponent.component_code.asc())).all()
        )

    def find_active_by_code(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        component_code: str,
        exclude_id: UUID | None = None,
    ) -> AstAssetComponent | None:
        stmt = select(AstAssetComponent).where(
            AstAssetComponent.asset_id == asset_id,
            AstAssetComponent.component_code == component_code,
            AstAssetComponent.status == AssetComponentStatus.ACTIVE.value,
            AstAssetComponent.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAssetComponent.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetComponent, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def find_active_by_serial(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        serial_number: str,
        exclude_id: UUID | None = None,
    ) -> AstAssetComponent | None:
        stmt = select(AstAssetComponent).where(
            AstAssetComponent.company_id == company_id,
            AstAssetComponent.serial_number == serial_number,
            AstAssetComponent.status == AssetComponentStatus.ACTIVE.value,
            AstAssetComponent.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAssetComponent.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetComponent, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_code_history(
        self, ctx: TenantContext, *, asset_id: UUID, component_code: str
    ) -> list[AstAssetComponent]:
        stmt = (
            select(AstAssetComponent)
            .where(
                AstAssetComponent.asset_id == asset_id,
                AstAssetComponent.component_code == component_code,
                AstAssetComponent.is_deleted.is_(False),
            )
            .order_by(AstAssetComponent.created_at.asc())
        )
        stmt = self.apply_ast_filter(stmt, AstAssetComponent, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def get_parent_asset(self, ctx: TenantContext, asset_id: UUID) -> AstAsset | None:
        stmt = select(AstAsset).where(
            AstAsset.id == asset_id,
            AstAsset.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def lock_for_update(self, ctx: TenantContext, row_id: UUID) -> AstAssetComponent | None:
        """Row lock to serialize concurrent issue attempts for the same component."""
        stmt = (
            select(AstAssetComponent)
            .where(AstAssetComponent.id == row_id, AstAssetComponent.is_deleted.is_(False))
            .with_for_update()
        )
        stmt = self.apply_ast_filter(stmt, AstAssetComponent, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_by_asset_ids(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        asset_ids: list[UUID],
        status: str | None = AssetComponentStatus.ACTIVE.value,
    ) -> list[AstAssetComponent]:
        if not asset_ids:
            return []
        stmt = select(AstAssetComponent).where(
            AstAssetComponent.company_id == company_id,
            AstAssetComponent.asset_id.in_(asset_ids),
            AstAssetComponent.is_deleted.is_(False),
        )
        if status is not None:
            stmt = stmt.where(AstAssetComponent.status == status)
        stmt = self.apply_ast_filter(stmt, AstAssetComponent, ctx, branch_scoped=False)
        return list(
            self.db.scalars(
                stmt.order_by(
                    AstAssetComponent.asset_id.asc(),
                    AstAssetComponent.component_code.asc(),
                )
            ).all()
        )

    def create(self, ctx: TenantContext, **fields) -> AstAssetComponent:
        row = AstAssetComponent(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetComponent | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Asset component has been modified by another user; reload and retry"
            )
        for key, value in fields.items():
            if value is not None or key in {
                "branch_id",
                "product_id",
                "serial_number",
                "quantity",
                "component_name",
            }:
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
