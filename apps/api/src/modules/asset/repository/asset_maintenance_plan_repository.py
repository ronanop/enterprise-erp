"""Asset AstAssetMaintenancePlan repository (FP-ASSET-011)."""

from dataclasses import dataclass
from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.domain.enums import AssetMaintenancePlanStatus
from modules.asset.models import AstAsset, AstAssetMaintenancePlan
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

ACTIVE_STATUS = AssetMaintenancePlanStatus.ACTIVE.value


@dataclass(frozen=True)
class AssetMaintenancePlanListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    maintenance_type: str | None = None
    status: str | None = None
    next_due_date: date | None = None
    branch_id: UUID | None = None
    search: str | None = None


class AssetMaintenancePlanRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetMaintenancePlan | None:
        stmt = select(AstAssetMaintenancePlan).where(
            AstAssetMaintenancePlan.id == row_id,
            AstAssetMaintenancePlan.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetMaintenancePlan, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetMaintenancePlanListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def find_active_for_asset(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        asset_id: UUID,
        exclude_id: UUID | None = None,
    ) -> AstAssetMaintenancePlan | None:
        stmt = select(AstAssetMaintenancePlan).where(
            AstAssetMaintenancePlan.company_id == company_id,
            AstAssetMaintenancePlan.asset_id == asset_id,
            AstAssetMaintenancePlan.is_deleted.is_(False),
            AstAssetMaintenancePlan.status == ACTIVE_STATUS,
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAssetMaintenancePlan.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetMaintenancePlan, ctx, branch_scoped=False)
        return self.db.scalars(stmt.limit(1)).first()

    def search(
        self,
        ctx: TenantContext,
        filters: AssetMaintenancePlanListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetMaintenancePlan], int]:
        stmt = (
            select(AstAssetMaintenancePlan)
            .outerjoin(AstAsset, AstAsset.id == AstAssetMaintenancePlan.asset_id)
            .where(
                AstAssetMaintenancePlan.company_id == filters.company_id,
                AstAssetMaintenancePlan.is_deleted.is_(False),
            )
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetMaintenancePlan.asset_id == filters.asset_id)
        if filters.maintenance_type is not None:
            stmt = stmt.where(
                AstAssetMaintenancePlan.maintenance_type == filters.maintenance_type
            )
        if filters.status is not None:
            stmt = stmt.where(AstAssetMaintenancePlan.status == filters.status)
        if filters.next_due_date is not None:
            stmt = stmt.where(AstAssetMaintenancePlan.next_due_date == filters.next_due_date)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetMaintenancePlan.branch_id == filters.branch_id)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetMaintenancePlan.document_number.ilike(term),
                    AstAssetMaintenancePlan.plan_name.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetMaintenancePlan, ctx, branch_scoped=False)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetMaintenancePlan.created_at.desc())
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return rows, total

    def create(self, ctx: TenantContext, **fields) -> AstAssetMaintenancePlan:
        row = AstAssetMaintenancePlan(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetMaintenancePlan | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Maintenance plan has been modified by another user; reload and retry"
            )
        for k, v in fields.items():
            if v is not None or k in {
                "branch_id",
                "frequency_days",
                "frequency_meter_units",
                "next_due_date",
                "plan_name",
                "maintenance_type",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
