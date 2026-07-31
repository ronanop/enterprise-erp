"""Asset AstAsset repository."""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from modules.asset.models import AstAsset
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


@dataclass(frozen=True)
class AssetListFilters:
    company_id: UUID
    branch_id: UUID | None = None
    status: str | None = None
    asset_category_id: UUID | None = None
    search: str | None = None


class AssetRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAsset | None:
        stmt = select(AstAsset).where(AstAsset.id == row_id, AstAsset.is_deleted.is_(False))
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

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
