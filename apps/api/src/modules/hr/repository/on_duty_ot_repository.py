"""On-duty request + OT allotment repositories."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.on_duty_request import HrOnDutyRequest
from modules.hr.models.ot_allotment import HrOtAllotment
from modules.hr.repository.base import HrScopedRepository, utcnow


class OnDutyRequestRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrOnDutyRequest | None:
        stmt = select(HrOnDutyRequest).where(
            HrOnDutyRequest.id == row_id,
            HrOnDutyRequest.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrOnDutyRequest, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(HrOnDutyRequest).where(
            HrOnDutyRequest.company_id == company_id,
            HrOnDutyRequest.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrOnDutyRequest, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrOnDutyRequest:
        row = HrOnDutyRequest(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrOnDutyRequest | None:
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


class OtAllotmentRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrOtAllotment | None:
        stmt = select(HrOtAllotment).where(
            HrOtAllotment.id == row_id,
            HrOtAllotment.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrOtAllotment, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(HrOtAllotment).where(
            HrOtAllotment.company_id == company_id,
            HrOtAllotment.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrOtAllotment, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrOtAllotment:
        row = HrOtAllotment(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrOtAllotment | None:
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
