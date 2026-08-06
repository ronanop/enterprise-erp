"""Asset AstAsset repository."""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from modules.asset.domain.enums import AssetOperationalStatus
from modules.asset.models import AstAsset
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


@dataclass(frozen=True)
class AssetListFilters:
    company_id: UUID
    branch_id: UUID | None = None
    status: str | None = None
    operational_status: str | None = None
    asset_category_id: UUID | None = None
    search: str | None = None


@dataclass(frozen=True)
class OperationalStatusCounts:
    total_assets: int
    ready_to_move: int
    assigned: int
    retired: int
    pending_disposal: int
    disposed: int


@dataclass(frozen=True)
class BranchOperationalSummary:
    branch_id: UUID
    total_assets: int
    ready_to_move: int
    assigned: int
    retired: int
    pending_disposal: int
    disposed: int


_OPS_STATUS_TO_COUNT_ATTR: dict[str, str] = {
    AssetOperationalStatus.READY_TO_MOVE.value: "ready_to_move",
    AssetOperationalStatus.ASSIGNED.value: "assigned",
    AssetOperationalStatus.RETIRED.value: "retired",
    AssetOperationalStatus.PENDING_DISPOSAL.value: "pending_disposal",
    AssetOperationalStatus.DISPOSED.value: "disposed",
}


class AssetRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAsset | None:
        stmt = select(AstAsset).where(AstAsset.id == row_id, AstAsset.is_deleted.is_(False))
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def get_operational_status(self, ctx: TenantContext, row_id: UUID) -> str | None:
        """Read operational_status only."""
        row = self.get(ctx, row_id)
        if row is None:
            return None
        return row.operational_status

    def set_operational_status(
        self,
        ctx: TenantContext,
        row_id: UUID,
        operational_status: str,
        *,
        expected_version: int | None = None,
        row: AstAsset | None = None,
    ) -> AstAsset | None:
        """Persist operational_status only (no transition validation)."""
        from modules.asset.domain.operational_status_exceptions import OperationalStatusConflict

        if row is None:
            row = self.lock_for_update(ctx, row_id)
        if row is None:
            return None
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise OperationalStatusConflict()
        row.operational_status = operational_status
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row

    def lock_for_update(self, ctx: TenantContext, row_id: UUID) -> AstAsset | None:
        """Row lock for serializing meter-reading creates when no prior reading exists."""
        stmt = (
            select(AstAsset)
            .where(AstAsset.id == row_id, AstAsset.is_deleted.is_(False))
            .with_for_update()
        )
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def find_by_code(self, ctx: TenantContext, company_id: UUID, asset_code: str) -> AstAsset | None:
        stmt = select(AstAsset).where(
            AstAsset.company_id == company_id,
            AstAsset.asset_code == asset_code,
            AstAsset.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def find_by_serial(
        self,
        ctx: TenantContext,
        company_id: UUID,
        serial_number: str,
        *,
        exclude_id: UUID | None = None,
    ) -> AstAsset | None:
        stmt = select(AstAsset).where(
            AstAsset.company_id == company_id,
            AstAsset.serial_number == serial_number,
            AstAsset.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAsset.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def find_by_barcode(
        self,
        ctx: TenantContext,
        company_id: UUID,
        barcode: str,
        *,
        exclude_id: UUID | None = None,
    ) -> AstAsset | None:
        stmt = select(AstAsset).where(
            AstAsset.company_id == company_id,
            AstAsset.barcode == barcode,
            AstAsset.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAsset.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(ctx, AssetListFilters(company_id=company_id), offset=0, limit=10_000)
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAsset], int]:
        stmt = select(AstAsset).where(
            AstAsset.company_id == filters.company_id,
            AstAsset.is_deleted.is_(False),
        )
        if filters.branch_id is not None:
            stmt = stmt.where(AstAsset.branch_id == filters.branch_id)
        if filters.status is not None:
            stmt = stmt.where(AstAsset.status == filters.status)
        if filters.operational_status is not None:
            stmt = stmt.where(AstAsset.operational_status == filters.operational_status)
        if filters.asset_category_id is not None:
            stmt = stmt.where(AstAsset.asset_category_id == filters.asset_category_id)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAsset.asset_name.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.document_number.ilike(term),
                    AstAsset.serial_number.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAsset.created_at.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def count_operational_by_category(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        asset_category_id: UUID,
        statuses: frozenset[str] | set[str],
    ) -> int:
        """Count non-deleted assets in operational statuses for a category (CR-001)."""
        stmt = select(func.count()).select_from(AstAsset).where(
            AstAsset.company_id == company_id,
            AstAsset.asset_category_id == asset_category_id,
            AstAsset.is_deleted.is_(False),
            AstAsset.status.in_(tuple(statuses)),
        )
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=False)
        return int(self.db.scalar(stmt) or 0)

    def count_by_operational_status(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        operational_status: str,
        branch_id: UUID | None = None,
    ) -> int:
        inner = select(AstAsset.id).where(
            AstAsset.company_id == company_id,
            AstAsset.is_deleted.is_(False),
            AstAsset.operational_status == operational_status,
        )
        if branch_id is not None:
            inner = inner.where(AstAsset.branch_id == branch_id)
        inner = self.apply_ast_filter(inner, AstAsset, ctx, branch_scoped=True)
        return int(self.db.scalar(select(func.count()).select_from(inner.subquery())) or 0)

    def dashboard_summary(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID | None = None,
    ) -> OperationalStatusCounts:
        inner = select(AstAsset.operational_status, func.count().label("cnt")).where(
            AstAsset.company_id == company_id,
            AstAsset.is_deleted.is_(False),
        )
        if branch_id is not None:
            inner = inner.where(AstAsset.branch_id == branch_id)
        inner = self.apply_ast_filter(inner, AstAsset, ctx, branch_scoped=True)
        inner = inner.group_by(AstAsset.operational_status)
        rows = self.db.execute(inner).all()

        buckets = {attr: 0 for attr in _OPS_STATUS_TO_COUNT_ATTR.values()}
        for status_value, cnt in rows:
            attr = _OPS_STATUS_TO_COUNT_ATTR.get(status_value)
            if attr is not None:
                buckets[attr] = int(cnt or 0)

        total_stmt = select(func.count()).select_from(AstAsset).where(
            AstAsset.company_id == company_id,
            AstAsset.is_deleted.is_(False),
        )
        if branch_id is not None:
            total_stmt = total_stmt.where(AstAsset.branch_id == branch_id)
        total_stmt = self.apply_ast_filter(total_stmt, AstAsset, ctx, branch_scoped=True)
        total = int(self.db.scalar(total_stmt) or 0)

        return OperationalStatusCounts(
            total_assets=total,
            ready_to_move=buckets["ready_to_move"],
            assigned=buckets["assigned"],
            retired=buckets["retired"],
            pending_disposal=buckets["pending_disposal"],
            disposed=buckets["disposed"],
        )

    def summary_by_branch(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
    ) -> list[BranchOperationalSummary]:
        inner = select(
            AstAsset.branch_id,
            AstAsset.operational_status,
            func.count().label("cnt"),
        ).where(
            AstAsset.company_id == company_id,
            AstAsset.is_deleted.is_(False),
        )
        inner = self.apply_ast_filter(inner, AstAsset, ctx, branch_scoped=True)
        inner = inner.group_by(AstAsset.branch_id, AstAsset.operational_status)
        rows = self.db.execute(inner).all()

        by_branch: dict[UUID, dict[str, int]] = {}
        for branch_id, status_value, cnt in rows:
            if branch_id is None:
                continue
            bucket = by_branch.setdefault(
                branch_id,
                {attr: 0 for attr in _OPS_STATUS_TO_COUNT_ATTR.values()},
            )
            attr = _OPS_STATUS_TO_COUNT_ATTR.get(status_value)
            if attr is not None:
                bucket[attr] = int(cnt or 0)

        totals_stmt = select(AstAsset.branch_id, func.count().label("cnt")).where(
            AstAsset.company_id == company_id,
            AstAsset.is_deleted.is_(False),
        )
        totals_stmt = self.apply_ast_filter(totals_stmt, AstAsset, ctx, branch_scoped=True)
        totals_stmt = totals_stmt.group_by(AstAsset.branch_id)
        total_rows = self.db.execute(totals_stmt).all()
        totals_map = {bid: int(cnt or 0) for bid, cnt in total_rows if bid is not None}

        summaries: list[BranchOperationalSummary] = []
        for branch_id, buckets in sorted(by_branch.items(), key=lambda x: str(x[0])):
            summaries.append(
                BranchOperationalSummary(
                    branch_id=branch_id,
                    total_assets=totals_map.get(branch_id, sum(buckets.values())),
                    ready_to_move=buckets["ready_to_move"],
                    assigned=buckets["assigned"],
                    retired=buckets["retired"],
                    pending_disposal=buckets["pending_disposal"],
                    disposed=buckets["disposed"],
                )
            )
        return summaries

    def create(self, ctx: TenantContext, **fields) -> AstAsset:
        row = AstAsset(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAsset | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            from core.exceptions import ConflictException

            raise ConflictException("Asset version conflict; refresh and retry")
        # CR-004 Phase 2A: operational transitions not implemented — ignore writes.
        fields.pop("operational_status", None)
        for k, v in fields.items():
            if v is not None or k in {
                "workflow_status",
                "workflow_instance_id",
                "custodian_employee_id",
                "current_book_value",
                "discovery_profile_json",
                "serial_number",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
