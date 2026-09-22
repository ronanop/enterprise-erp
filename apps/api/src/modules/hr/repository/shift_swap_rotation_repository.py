"""Shift swap + rotation repositories."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.shift_rotation import HrShiftRotation
from modules.hr.models.shift_swap import HrShiftSwapRequest
from modules.hr.repository.base import HrScopedRepository, utcnow


class ShiftRotationRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrShiftRotation | None:
        stmt = select(HrShiftRotation).where(
            HrShiftRotation.id == row_id,
            HrShiftRotation.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrShiftRotation, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID | None):
        stmt = select(HrShiftRotation).where(HrShiftRotation.is_deleted.is_(False))
        if company_id is not None:
            stmt = stmt.where(HrShiftRotation.company_id == company_id)
        stmt = self.apply_hr_filter(stmt, HrShiftRotation, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrShiftRotation:
        row = HrShiftRotation(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrShiftRotation | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row


class ShiftSwapRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrShiftSwapRequest | None:
        stmt = select(HrShiftSwapRequest).where(
            HrShiftSwapRequest.id == row_id,
            HrShiftSwapRequest.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrShiftSwapRequest, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID | None):
        stmt = select(HrShiftSwapRequest).where(HrShiftSwapRequest.is_deleted.is_(False))
        if company_id is not None:
            stmt = stmt.where(HrShiftSwapRequest.company_id == company_id)
        stmt = self.apply_hr_filter(stmt, HrShiftSwapRequest, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrShiftSwapRequest:
        row = HrShiftSwapRequest(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrShiftSwapRequest | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
