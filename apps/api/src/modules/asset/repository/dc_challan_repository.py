"""Repository for standalone DC challan tracking."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from modules.asset.domain.enums import DcChallanStatus
from modules.asset.models.dc_challan import AstDcChallan
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

OPEN_DC_STATUSES: tuple[str, ...] = (
    DcChallanStatus.PENDING.value,
    DcChallanStatus.SENT_TO_SCM.value,
    DcChallanStatus.DOCUMENT_RECEIVED.value,
    DcChallanStatus.SIGNED.value,
)


@dataclass(frozen=True)
class DcChallanListFilters:
    company_id: UUID
    status: str | None = None
    asset_id: UUID | None = None
    assignment_id: UUID | None = None
    unlinked: bool = False
    search: str | None = None
    created_from: date | None = None
    created_to: date | None = None


def _as_row_list(items) -> list[AstDcChallan]:
    if items is None:
        return []
    if isinstance(items, (list, tuple)):
        return list(items)
    return []


class DcChallanRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstDcChallan | None:
        stmt = select(AstDcChallan).where(
            AstDcChallan.id == row_id,
            AstDcChallan.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstDcChallan, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def get_by_id_unscoped(self, row_id: UUID) -> AstDcChallan | None:
        """Lookup by id for SCM callback (service-key auth, no user JWT)."""
        stmt = select(AstDcChallan).where(
            AstDcChallan.id == row_id,
            AstDcChallan.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def search(
        self,
        ctx: TenantContext,
        filters: DcChallanListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstDcChallan], int]:
        stmt = select(AstDcChallan).where(
            AstDcChallan.company_id == filters.company_id,
            AstDcChallan.is_deleted.is_(False),
        )
        if filters.status is not None:
            stmt = stmt.where(AstDcChallan.status == filters.status)
        if filters.asset_id is not None:
            stmt = stmt.where(AstDcChallan.asset_id == filters.asset_id)
        if filters.assignment_id is not None:
            stmt = stmt.where(AstDcChallan.assignment_id == filters.assignment_id)
        if filters.unlinked:
            stmt = stmt.where(AstDcChallan.assignment_id.is_(None))
        if filters.created_from is not None:
            stmt = stmt.where(func.date(AstDcChallan.created_at) >= filters.created_from)
        if filters.created_to is not None:
            stmt = stmt.where(func.date(AstDcChallan.created_at) <= filters.created_to)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstDcChallan.dc_number.ilike(term),
                    AstDcChallan.asset_tag.ilike(term),
                    AstDcChallan.asset_name.ilike(term),
                    AstDcChallan.employee_name.ilike(term),
                    AstDcChallan.employee_code.ilike(term),
                    AstDcChallan.serial_number.ilike(term),
                    AstDcChallan.scm_reference_number.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstDcChallan, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = _as_row_list(
            self.db.scalars(
                stmt.order_by(AstDcChallan.created_at.desc()).offset(offset).limit(limit)
            ).all()
        )
        return rows, total

    def summary_counts(
        self, ctx: TenantContext, company_id: UUID
    ) -> dict[str, int]:
        stmt = (
            select(AstDcChallan.status, func.count())
            .where(
                AstDcChallan.company_id == company_id,
                AstDcChallan.is_deleted.is_(False),
            )
            .group_by(AstDcChallan.status)
        )
        stmt = self.apply_ast_filter(stmt, AstDcChallan, ctx, branch_scoped=True)
        counts = {status.value: 0 for status in DcChallanStatus}
        rows = self.db.execute(stmt).all()
        if isinstance(rows, list):
            for status, count in rows:
                if status in counts:
                    counts[status] = int(count or 0)
        return counts

    def list_open_for_assignment(
        self,
        ctx: TenantContext,
        assignment_id: UUID,
        *,
        statuses: frozenset[str] | None = None,
    ) -> list[AstDcChallan]:
        wanted = tuple(statuses) if statuses else OPEN_DC_STATUSES
        stmt = select(AstDcChallan).where(
            AstDcChallan.assignment_id == assignment_id,
            AstDcChallan.status.in_(wanted),
            AstDcChallan.is_deleted.is_(False),
        )
        # Branch-unscoped: origin-branch paperwork must still cancel after transfer.
        stmt = self.apply_ast_filter(stmt, AstDcChallan, ctx, branch_scoped=False)
        return _as_row_list(self.db.scalars(stmt).all())

    def list_open_for_asset(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        statuses: frozenset[str] | None = None,
    ) -> list[AstDcChallan]:
        wanted = tuple(statuses) if statuses else OPEN_DC_STATUSES
        stmt = select(AstDcChallan).where(
            AstDcChallan.asset_id == asset_id,
            AstDcChallan.status.in_(wanted),
            AstDcChallan.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstDcChallan, ctx, branch_scoped=False)
        return _as_row_list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> AstDcChallan:
        row = AstDcChallan(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstDcChallan | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for key, value in fields.items():
            setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()
        return row

    def update_row(self, ctx: TenantContext | None, row: AstDcChallan, **fields) -> AstDcChallan:
        for key, value in fields.items():
            setattr(row, key, value)
        row.updated_at = utcnow()
        if ctx is not None:
            row.updated_by = ctx.user_id
        self.db.flush()
        return row
