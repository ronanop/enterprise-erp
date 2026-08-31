"""Asset AstAssetInsurance repository (FP-ASSET-010)."""

from dataclasses import dataclass
from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.domain.enums import AssetInsuranceStatus
from modules.asset.models import AstAsset, AstAssetInsurance
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

OPEN_STATUSES = (
    AssetInsuranceStatus.ACTIVE.value,
    AssetInsuranceStatus.RENEWED.value,
)


@dataclass(frozen=True)
class AssetInsuranceListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    vendor_id: UUID | None = None
    status: str | None = None
    end_date: date | None = None
    search: str | None = None


class AssetInsuranceRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetInsurance | None:
        stmt = select(AstAssetInsurance).where(
            AstAssetInsurance.id == row_id,
            AstAssetInsurance.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetInsurance, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetInsuranceListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def find_open_for_asset(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        asset_id: UUID,
        exclude_id: UUID | None = None,
    ) -> AstAssetInsurance | None:
        stmt = select(AstAssetInsurance).where(
            AstAssetInsurance.company_id == company_id,
            AstAssetInsurance.asset_id == asset_id,
            AstAssetInsurance.is_deleted.is_(False),
            AstAssetInsurance.status.in_(OPEN_STATUSES),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAssetInsurance.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetInsurance, ctx, branch_scoped=False)
        return self.db.scalars(stmt.limit(1)).first()

    def search(
        self,
        ctx: TenantContext,
        filters: AssetInsuranceListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetInsurance], int]:
        stmt = (
            select(AstAssetInsurance)
            .outerjoin(AstAsset, AstAsset.id == AstAssetInsurance.asset_id)
            .where(
                AstAssetInsurance.company_id == filters.company_id,
                AstAssetInsurance.is_deleted.is_(False),
            )
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetInsurance.asset_id == filters.asset_id)
        if filters.vendor_id is not None:
            stmt = stmt.where(AstAssetInsurance.vendor_id == filters.vendor_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetInsurance.status == filters.status)
        if filters.end_date is not None:
            stmt = stmt.where(AstAssetInsurance.end_date == filters.end_date)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetInsurance.policy_number.ilike(term),
                    AstAssetInsurance.insurer_name.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetInsurance, ctx, branch_scoped=False)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetInsurance.created_at.desc())
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return rows, total

    def create(self, ctx: TenantContext, **fields) -> AstAssetInsurance:
        row = AstAssetInsurance(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetInsurance | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Asset insurance has been modified by another user; reload and retry"
            )
        for k, v in fields.items():
            if v is not None or k in {
                "vendor_id",
                "coverage_amount",
                "branch_id",
                "start_date",
                "end_date",
                "policy_number",
                "insurer_name",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
