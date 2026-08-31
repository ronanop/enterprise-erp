"""Non-IT asset repository."""

from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from modules.asset.models import AstNonitAsset, AstNonitAssetType, AstNonitLocation
from modules.asset.repository.base import AstScopedRepository
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.employee import MasterEmployee


class NonItAssetRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstNonitAsset | None:
        stmt = select(AstNonitAsset).where(
            AstNonitAsset.id == row_id,
            AstNonitAsset.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstNonitAsset, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def max_seq_for_prefix(
        self, company_id: UUID, prefix: str, *, include_deleted: bool = True
    ) -> int:
        """Highest numeric suffix for codes with this prefix (includes disposed/deleted)."""
        stmt = select(AstNonitAsset.asset_code).where(
            AstNonitAsset.company_id == company_id,
            AstNonitAsset.asset_code.like(f"{prefix}%"),
        )
        if not include_deleted:
            stmt = stmt.where(AstNonitAsset.is_deleted.is_(False))
        codes = list(self.db.scalars(stmt).all())
        max_n = 0
        plen = len(prefix)
        for code in codes:
            suffix = str(code)[plen:]
            if suffix.isdigit():
                max_n = max(max_n, int(suffix))
        return max_n

    def search(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        asset_type_id: UUID | None = None,
        location_id: UUID | None = None,
        status: str | None = None,
        assignment: str | None = None,
        q: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstNonitAsset], int]:
        stmt = select(AstNonitAsset).where(
            AstNonitAsset.company_id == company_id,
            AstNonitAsset.is_deleted.is_(False),
        )
        if asset_type_id is not None:
            stmt = stmt.where(AstNonitAsset.asset_type_id == asset_type_id)
        if location_id is not None:
            stmt = stmt.where(AstNonitAsset.current_location_id == location_id)
        if status:
            stmt = stmt.where(AstNonitAsset.status == status)
        if assignment == "assigned":
            stmt = stmt.where(
                or_(
                    AstNonitAsset.current_employee_id.is_not(None),
                    AstNonitAsset.current_location_id.is_not(None),
                )
            )
        elif assignment == "unassigned":
            stmt = stmt.where(
                AstNonitAsset.current_employee_id.is_(None),
                AstNonitAsset.current_location_id.is_(None),
            )
        if q and q.strip():
            term = f"%{q.strip()}%"
            emp_ids = select(MasterEmployee.id).where(
                MasterEmployee.company_id == company_id,
                MasterEmployee.is_deleted.is_(False),
                or_(
                    MasterEmployee.first_name.ilike(term),
                    MasterEmployee.last_name.ilike(term),
                    MasterEmployee.employee_code.ilike(term),
                    func.concat(
                        MasterEmployee.first_name, " ", MasterEmployee.last_name
                    ).ilike(term),
                ),
            )
            loc_ids = select(AstNonitLocation.id).where(
                AstNonitLocation.company_id == company_id,
                AstNonitLocation.is_deleted.is_(False),
                AstNonitLocation.name.ilike(term),
            )
            type_ids = select(AstNonitAssetType.id).where(
                AstNonitAssetType.company_id == company_id,
                AstNonitAssetType.is_deleted.is_(False),
                or_(
                    AstNonitAssetType.name.ilike(term),
                    AstNonitAssetType.prefix.ilike(term),
                ),
            )
            stmt = stmt.where(
                or_(
                    AstNonitAsset.asset_code.ilike(term),
                    AstNonitAsset.serial_number.ilike(term),
                    AstNonitAsset.remarks.ilike(term),
                    AstNonitAsset.current_employee_id.in_(emp_ids),
                    AstNonitAsset.current_location_id.in_(loc_ids),
                    AstNonitAsset.asset_type_id.in_(type_ids),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstNonitAsset, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstNonitAsset.asset_code.asc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def create(self, ctx: TenantContext, **fields) -> AstNonitAsset:
        row = AstNonitAsset(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstNonitAsset | None:
        from modules.asset.repository.base import utcnow

        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected = fields.pop("version", None)
        if expected is not None and int(row.version or 1) != int(expected):
            return None
        for key, value in fields.items():
            setattr(row, key, value)
        row.updated_by = ctx.user_id
        row.updated_at = utcnow()
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row

    def lock_for_update(self, ctx: TenantContext, row_id: UUID) -> AstNonitAsset | None:
        stmt = (
            select(AstNonitAsset)
            .where(
                AstNonitAsset.id == row_id,
                AstNonitAsset.is_deleted.is_(False),
            )
            .with_for_update()
        )
        stmt = self.apply_ast_filter(stmt, AstNonitAsset, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def locations_by_ids(
        self, ctx: TenantContext, ids: list[UUID]
    ) -> dict[UUID, AstNonitLocation]:
        if not ids:
            return {}
        stmt = select(AstNonitLocation).where(
            AstNonitLocation.id.in_(ids),
            AstNonitLocation.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstNonitLocation, ctx, branch_scoped=False)
        return {r.id: r for r in self.db.scalars(stmt).all()}

    def employees_by_ids(
        self, company_id: UUID, ids: list[UUID]
    ) -> dict[UUID, MasterEmployee]:
        if not ids:
            return {}
        stmt = select(MasterEmployee).where(
            MasterEmployee.id.in_(ids),
            MasterEmployee.company_id == company_id,
            MasterEmployee.is_deleted.is_(False),
        )
        return {r.id: r for r in self.db.scalars(stmt).all()}

    def types_by_ids(
        self, ctx: TenantContext, ids: list[UUID]
    ) -> dict[UUID, AstNonitAssetType]:
        if not ids:
            return {}
        stmt = select(AstNonitAssetType).where(
            AstNonitAssetType.id.in_(ids),
            AstNonitAssetType.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstNonitAssetType, ctx, branch_scoped=False)
        return {r.id: r for r in self.db.scalars(stmt).all()}

    def dashboard_summary(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        top_locations: int = 8,
    ) -> dict:
        """Aggregate Non-IT counts by status, active type, and top locations."""
        total_stmt = select(func.count()).select_from(AstNonitAsset).where(
            AstNonitAsset.company_id == company_id,
            AstNonitAsset.is_deleted.is_(False),
        )
        total_stmt = self.apply_ast_filter(
            total_stmt, AstNonitAsset, ctx, branch_scoped=True
        )
        total = int(self.db.scalar(total_stmt) or 0)

        status_stmt = (
            select(AstNonitAsset.status, func.count().label("cnt"))
            .where(
                AstNonitAsset.company_id == company_id,
                AstNonitAsset.is_deleted.is_(False),
            )
            .group_by(AstNonitAsset.status)
        )
        status_stmt = self.apply_ast_filter(
            status_stmt, AstNonitAsset, ctx, branch_scoped=True
        )
        status_map: dict[str, int] = {
            str(status): int(cnt or 0)
            for status, cnt in self.db.execute(status_stmt).all()
        }

        type_count_stmt = (
            select(AstNonitAsset.asset_type_id, func.count().label("cnt"))
            .where(
                AstNonitAsset.company_id == company_id,
                AstNonitAsset.is_deleted.is_(False),
            )
            .group_by(AstNonitAsset.asset_type_id)
        )
        type_count_stmt = self.apply_ast_filter(
            type_count_stmt, AstNonitAsset, ctx, branch_scoped=True
        )
        type_counts = {
            tid: int(cnt or 0)
            for tid, cnt in self.db.execute(type_count_stmt).all()
        }

        types_stmt = (
            select(AstNonitAssetType)
            .where(
                AstNonitAssetType.company_id == company_id,
                AstNonitAssetType.is_deleted.is_(False),
                AstNonitAssetType.active.is_(True),
            )
            .order_by(AstNonitAssetType.name.asc())
        )
        types_stmt = self.apply_ast_filter(
            types_stmt, AstNonitAssetType, ctx, branch_scoped=False
        )
        by_type = [
            {
                "asset_type_id": t.id,
                "name": t.name,
                "prefix": t.prefix,
                "count": type_counts.get(t.id, 0),
            }
            for t in self.db.scalars(types_stmt).all()
        ]

        loc_stmt = (
            select(
                AstNonitLocation.id,
                AstNonitLocation.name,
                func.count(AstNonitAsset.id).label("cnt"),
            )
            .select_from(AstNonitAsset)
            .join(
                AstNonitLocation,
                AstNonitLocation.id == AstNonitAsset.current_location_id,
            )
            .where(
                AstNonitAsset.company_id == company_id,
                AstNonitAsset.is_deleted.is_(False),
                AstNonitAsset.current_location_id.is_not(None),
                AstNonitLocation.is_deleted.is_(False),
            )
            .group_by(AstNonitLocation.id, AstNonitLocation.name)
            .order_by(func.count(AstNonitAsset.id).desc(), AstNonitLocation.name.asc())
            .limit(top_locations)
        )
        loc_stmt = self.apply_ast_filter(
            loc_stmt, AstNonitAsset, ctx, branch_scoped=True
        )
        by_location = [
            {"location_id": lid, "name": name, "count": int(cnt or 0)}
            for lid, name, cnt in self.db.execute(loc_stmt).all()
        ]

        return {
            "total_assets": total,
            "status_map": status_map,
            "by_type": by_type,
            "by_location": by_location,
        }
