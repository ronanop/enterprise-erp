"""Asset AstAssetMaintenance repository (FP-ASSET-004)."""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.domain.enums import AssetMaintenanceStatus
from modules.asset.models import AstAsset, AstAssetMaintenance
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

OPEN_WO_STATUSES = (
    AssetMaintenanceStatus.DRAFT.value,
    AssetMaintenanceStatus.SUBMITTED.value,
    AssetMaintenanceStatus.APPROVED.value,
    AssetMaintenanceStatus.SCHEDULED.value,
    AssetMaintenanceStatus.IN_PROGRESS.value,
)


@dataclass(frozen=True)
class AssetMaintenanceListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    branch_id: UUID | None = None
    status: str | None = None
    maintenance_type: str | None = None
    search: str | None = None
    open_only: bool = False


class AssetMaintenanceRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetMaintenance | None:
        stmt = select(AstAssetMaintenance).where(
            AstAssetMaintenance.id == row_id,
            AstAssetMaintenance.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetMaintenance, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetMaintenanceListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetMaintenanceListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetMaintenance], int]:
        stmt = (
            select(AstAssetMaintenance)
            .join(AstAsset, AstAsset.id == AstAssetMaintenance.asset_id)
            .where(
                AstAssetMaintenance.company_id == filters.company_id,
                AstAssetMaintenance.is_deleted.is_(False),
                AstAsset.is_deleted.is_(False),
            )
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetMaintenance.asset_id == filters.asset_id)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetMaintenance.branch_id == filters.branch_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetMaintenance.status == filters.status)
        if filters.open_only:
            stmt = stmt.where(AstAssetMaintenance.status.in_(OPEN_WO_STATUSES))
        if filters.maintenance_type is not None:
            stmt = stmt.where(AstAssetMaintenance.maintenance_type == filters.maintenance_type)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetMaintenance.document_number.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetMaintenance, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetMaintenance.created_at.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def find_open_for_asset(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        exclude_id: UUID | None = None,
    ) -> AstAssetMaintenance | None:
        stmt = select(AstAssetMaintenance).where(
            AstAssetMaintenance.asset_id == asset_id,
            AstAssetMaintenance.status.in_(OPEN_WO_STATUSES),
            AstAssetMaintenance.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAssetMaintenance.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetMaintenance, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> AstAssetMaintenance:
        row = AstAssetMaintenance(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetMaintenance | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Maintenance has been modified by another user; reload and retry"
            )
        for k, v in fields.items():
            if v is not None or k in {
                "workflow_status",
                "workflow_instance_id",
                "vendor_id",
                "technician_employee_id",
                "maintenance_plan_id",
                "scheduled_date",
                "completed_date",
                "cost_amount",
                "quality_inspection_id",
                "reason",
                "expected_duration_days",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
