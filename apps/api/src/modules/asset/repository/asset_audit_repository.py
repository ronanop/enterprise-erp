"""Asset AstAssetAudit repository (FP-ASSET-008)."""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.models import AstAsset, AstAssetAudit
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


@dataclass(frozen=True)
class AssetAuditListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    auditor_employee_id: UUID | None = None
    status: str | None = None
    found_status: str | None = None
    search: str | None = None


class AssetAuditRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetAudit | None:
        stmt = select(AstAssetAudit).where(
            AstAssetAudit.id == row_id,
            AstAssetAudit.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetAudit, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetAuditListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetAuditListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetAudit], int]:
        stmt = (
            select(AstAssetAudit)
            .outerjoin(AstAsset, AstAsset.id == AstAssetAudit.asset_id)
            .where(
                AstAssetAudit.company_id == filters.company_id,
                AstAssetAudit.is_deleted.is_(False),
            )
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetAudit.asset_id == filters.asset_id)
        if filters.auditor_employee_id is not None:
            stmt = stmt.where(AstAssetAudit.auditor_employee_id == filters.auditor_employee_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetAudit.status == filters.status)
        if filters.found_status is not None:
            stmt = stmt.where(AstAssetAudit.found_status == filters.found_status)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetAudit.document_number.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                    AstAssetAudit.notes.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetAudit, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetAudit.created_at.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def create(self, ctx: TenantContext, **fields) -> AstAssetAudit:
        row = AstAssetAudit(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetAudit | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Asset audit has been modified by another user; reload and retry"
            )
        for k, v in fields.items():
            if v is not None or k in {
                "audit_date",
                "found_status",
                "notes",
                "asset_id",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
