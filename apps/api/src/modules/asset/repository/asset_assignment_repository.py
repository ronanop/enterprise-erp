"""Asset assignment repository."""

from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.models import AstAsset, AstAssetAssignment
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


@dataclass(frozen=True)
class AssetAssignmentListFilters:
    company_id: UUID
    asset_id: UUID | None = None
    branch_id: UUID | None = None
    status: str | None = None
    allocation_type: str | None = None
    search: str | None = None


class AssetAssignmentRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetAssignment | None:
        stmt = select(AstAssetAssignment).where(
            AstAssetAssignment.id == row_id,
            AstAssetAssignment.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetAssignment, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetAssignmentListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetAssignmentListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetAssignment], int]:
        stmt = (
            select(AstAssetAssignment)
            .join(AstAsset, AstAsset.id == AstAssetAssignment.asset_id)
            .where(
                AstAssetAssignment.company_id == filters.company_id,
                AstAssetAssignment.is_deleted.is_(False),
                AstAsset.is_deleted.is_(False),
            )
        )
        if filters.asset_id is not None:
            stmt = stmt.where(AstAssetAssignment.asset_id == filters.asset_id)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetAssignment.branch_id == filters.branch_id)
        if filters.status is not None:
            stmt = stmt.where(AstAssetAssignment.status == filters.status)
        if filters.allocation_type is not None:
            stmt = stmt.where(AstAssetAssignment.allocation_type == filters.allocation_type)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetAssignment.document_number.ilike(term),
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetAssignment, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAssetAssignment.created_at.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def find_pending_or_active_for_asset(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        exclude_id: UUID | None = None,
    ) -> AstAssetAssignment | None:
        stmt = select(AstAssetAssignment).where(
            AstAssetAssignment.asset_id == asset_id,
            AstAssetAssignment.status.in_(["draft", "submitted", "approved", "active"]),
            AstAssetAssignment.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstAssetAssignment.id != exclude_id)
        stmt = self.apply_ast_filter(stmt, AstAssetAssignment, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> AstAssetAssignment:
        row = AstAssetAssignment(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def complete_return(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        status: str,
        returned_at,
        return_remarks: str | None,
    ) -> AstAssetAssignment | None:
        return self.update(
            ctx,
            row_id,
            status=status,
            returned_at=returned_at,
            return_remarks=return_remarks,
        )

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetAssignment | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException("Assignment has been modified by another user; reload and retry")
        for k, v in fields.items():
            if v is not None or k in {
                "workflow_status",
                "workflow_instance_id",
                "employee_id",
                "employee_source",
                "manual_employee_name",
                "manual_employee_phone",
                "manual_employee_email",
                "manual_employee_deployed_to",
                "department_id",
                "project_id",
                "expected_return_at",
                "delivery_reference_number",
                "delivery_reference_status",
                "delivery_challan_signature_status",
                "assignment_remarks",
                "return_remarks",
            }:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
