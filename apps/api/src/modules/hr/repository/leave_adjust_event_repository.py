"""HR HrLeaveAdjustEvent repository."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.leave_adjust_event import HrLeaveAdjustEvent
from modules.hr.repository.base import HrScopedRepository, utcnow


class LeaveAdjustEventRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_open_for_employee(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID,
        period_start: date,
        period_end: date,
        company_id: UUID | None = None,
    ) -> list[HrLeaveAdjustEvent]:
        stmt = select(HrLeaveAdjustEvent).where(
            HrLeaveAdjustEvent.is_deleted.is_(False),
            HrLeaveAdjustEvent.employee_id == employee_id,
            HrLeaveAdjustEvent.reverted_at.is_(None),
            HrLeaveAdjustEvent.attendance_date >= period_start,
            HrLeaveAdjustEvent.attendance_date <= period_end,
        )
        if company_id is not None:
            stmt = stmt.where(HrLeaveAdjustEvent.company_id == company_id)
        stmt = self.apply_hr_filter(stmt, HrLeaveAdjustEvent, ctx, branch_scoped=True)
        stmt = stmt.order_by(HrLeaveAdjustEvent.attendance_date.asc())
        return list(self.db.scalars(stmt).all())

    def list_history(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID | None = None,
        period_start: date | None = None,
        period_end: date | None = None,
        company_id: UUID | None = None,
        payroll_run_id: UUID | None = None,
    ) -> list[HrLeaveAdjustEvent]:
        stmt = select(HrLeaveAdjustEvent).where(HrLeaveAdjustEvent.is_deleted.is_(False))
        if company_id is not None:
            stmt = stmt.where(HrLeaveAdjustEvent.company_id == company_id)
        if employee_id is not None:
            stmt = stmt.where(HrLeaveAdjustEvent.employee_id == employee_id)
        if period_start is not None:
            stmt = stmt.where(HrLeaveAdjustEvent.attendance_date >= period_start)
        if period_end is not None:
            stmt = stmt.where(HrLeaveAdjustEvent.attendance_date <= period_end)
        if payroll_run_id is not None:
            stmt = stmt.where(HrLeaveAdjustEvent.payroll_run_id == payroll_run_id)
        stmt = self.apply_hr_filter(stmt, HrLeaveAdjustEvent, ctx, branch_scoped=True)
        stmt = stmt.order_by(HrLeaveAdjustEvent.confirmed_at.desc(), HrLeaveAdjustEvent.attendance_date.desc())
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrLeaveAdjustEvent:
        row = HrLeaveAdjustEvent(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrLeaveAdjustEvent | None:
        stmt = select(HrLeaveAdjustEvent).where(
            HrLeaveAdjustEvent.id == row_id,
            HrLeaveAdjustEvent.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrLeaveAdjustEvent, ctx, branch_scoped=True)
        row = self.db.scalar(stmt)
        if row is None:
            return None
        for key, value in fields.items():
            setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
