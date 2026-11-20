"""HR / master-data read ports for ESS workplace + attendance."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models import HrRosterEntry, HrShift, HrShiftAssignment
from modules.hr.models.training_request import HrTrainingRequest
from modules.master_data.models.employee import MasterEmployee


class EssHrAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_shift(self, ctx: TenantContext, *, employee_id: UUID, day: date) -> HrShift | None:
        roster = self._db.scalar(
            select(HrRosterEntry).where(
                HrRosterEntry.tenant_id == ctx.tenant_id,
                HrRosterEntry.employee_id == employee_id,
                HrRosterEntry.roster_date == day,
                HrRosterEntry.is_deleted.is_(False),
                HrRosterEntry.status == "published",
            )
        )
        shift_id = roster.shift_id if roster else None
        if shift_id is None:
            assignment = self._db.scalar(
                select(HrShiftAssignment)
                .where(
                    HrShiftAssignment.tenant_id == ctx.tenant_id,
                    HrShiftAssignment.employee_id == employee_id,
                    HrShiftAssignment.is_deleted.is_(False),
                    HrShiftAssignment.status.in_(("active", "approved")),
                    HrShiftAssignment.effective_from <= day,
                    or_(
                        HrShiftAssignment.effective_to.is_(None),
                        HrShiftAssignment.effective_to >= day,
                    ),
                )
                .order_by(HrShiftAssignment.effective_from.desc())
            )
            shift_id = assignment.shift_id if assignment else None
        if shift_id is None:
            return None
        return self._db.scalar(
            select(HrShift).where(
                HrShift.id == shift_id,
                HrShift.is_deleted.is_(False),
            )
        )

    def list_direct_report_ids(self, *, manager_employee_id: UUID) -> list[UUID]:
        return list(
            self._db.scalars(
                select(MasterEmployee.id).where(
                    MasterEmployee.reporting_manager_id == manager_employee_id,
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all()
        )

    def list_direct_reports(self, *, manager_employee_id: UUID) -> list[MasterEmployee]:
        return list(
            self._db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.reporting_manager_id == manager_employee_id,
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all()
        )

    def list_room_bookings(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        on_date: date | None = None,
    ) -> list[HrTrainingRequest]:
        q = select(HrTrainingRequest).where(
            HrTrainingRequest.tenant_id == ctx.tenant_id,
            HrTrainingRequest.company_id == company_id,
            HrTrainingRequest.is_deleted.is_(False),
            HrTrainingRequest.room_id.isnot(None),
            HrTrainingRequest.status.in_(("submitted", "approved", "cancelled", "rejected")),
        )
        if on_date is not None:
            q = q.where(HrTrainingRequest.request_date == on_date)
        return list(
            self._db.scalars(
                q.order_by(HrTrainingRequest.request_date, HrTrainingRequest.start_time)
            ).all()
        )

    def list_room_bookings_for_day(
        self, ctx: TenantContext, *, company_id: UUID, on_date: date
    ) -> list[HrTrainingRequest]:
        return list(
            self._db.scalars(
                select(HrTrainingRequest).where(
                    HrTrainingRequest.tenant_id == ctx.tenant_id,
                    HrTrainingRequest.company_id == company_id,
                    HrTrainingRequest.is_deleted.is_(False),
                    HrTrainingRequest.request_date == on_date,
                    HrTrainingRequest.room_id.isnot(None),
                    HrTrainingRequest.status.in_(("submitted", "approved")),
                )
            ).all()
        )

    def employee_display_names(
        self, ctx: TenantContext, employee_ids: set[UUID]
    ) -> dict[UUID, str]:
        if not employee_ids:
            return {}
        rows = list(
            self._db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.tenant_id == ctx.tenant_id,
                    MasterEmployee.id.in_(employee_ids),
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all()
        )
        out: dict[UUID, str] = {}
        for row in rows:
            name = " ".join(
                p for p in (getattr(row, "first_name", None), getattr(row, "last_name", None)) if p
            ).strip()
            out[row.id] = name or getattr(row, "employee_code", None) or str(row.id)
        return out
