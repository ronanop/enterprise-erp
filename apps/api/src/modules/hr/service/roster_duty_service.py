"""HRMS shift-roster duty resolution for Service ticket visibility.

When Service roster visibility is enabled, only employees on a published
roster / active shift assignment whose shift window covers "now" are
considered on duty. Service never imports these models — it calls
HRIntegrationService / ServiceHrAdapter instead.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from core.config import settings
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.roster_entry import HrRosterEntry
from modules.hr.models.shift import HrShift
from modules.hr.models.shift_assignment import HrShiftAssignment
from modules.hr.service.hr_scope_validator import HrScopeValidator

logger = logging.getLogger(__name__)


def _is_missing_relation(exc: BaseException) -> bool:
    """True when Postgres/SQLAlchemy report a missing table (migrations not applied)."""
    msg = str(exc).lower()
    return "does not exist" in msg or "undefinedtable" in msg


def shift_covers_local_time(start: time, end: time, *, is_overnight: bool, local_time: time) -> bool:
    """Return True if local_time falls inside the shift window."""
    overnight = is_overnight or start > end
    if overnight:
        return local_time >= start or local_time <= end
    return start <= local_time <= end


class RosterDutyService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scope = HrScopeValidator(db)

    def list_on_duty_employee_ids(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        at: datetime | None = None,
    ) -> set[UUID]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        now = at or datetime.now(timezone.utc)
        local_now = self._to_business_local(now)
        local_t = local_now.time()
        today = local_now.date()
        yesterday = today - timedelta(days=1)

        on_duty: set[UUID] = set()

        # 1) Published daily roster (preferred once HRMS roster UI is live).
        # Use SAVEPOINT so a missing HR table never rolls back an outer ticket create.
        try:
            with self._db.begin_nested():
                roster_rows = list(
                    self._db.execute(
                        select(HrRosterEntry, HrShift)
                        .join(HrShift, HrShift.id == HrRosterEntry.shift_id)
                        .where(
                            HrRosterEntry.company_id == cid,
                            HrRosterEntry.tenant_id == ctx.tenant_id,
                            HrRosterEntry.is_deleted.is_(False),
                            HrRosterEntry.status == "published",
                            HrRosterEntry.roster_date.in_((today, yesterday)),
                            HrShift.is_deleted.is_(False),
                            HrShift.status == "active",
                        )
                    ).all()
                )
        except ProgrammingError as exc:
            if not _is_missing_relation(exc):
                raise
            logger.warning("HR roster tables missing; skipping published roster lookup")
            roster_rows = []
        for entry, shift in roster_rows:
            if not self._roster_row_active(entry, shift, today=today, yesterday=yesterday, local_t=local_t):
                continue
            on_duty.add(entry.employee_id)

        # 2) Fallback: active date-range shift assignments.
        try:
            with self._db.begin_nested():
                assignment_rows = list(
                    self._db.execute(
                        select(HrShiftAssignment, HrShift)
                        .join(HrShift, HrShift.id == HrShiftAssignment.shift_id)
                        .where(
                            HrShiftAssignment.company_id == cid,
                            HrShiftAssignment.tenant_id == ctx.tenant_id,
                            HrShiftAssignment.is_deleted.is_(False),
                            HrShiftAssignment.status.in_(("active", "approved")),
                            HrShiftAssignment.effective_from <= today,
                            or_(
                                HrShiftAssignment.effective_to.is_(None),
                                HrShiftAssignment.effective_to >= yesterday,
                            ),
                            HrShift.is_deleted.is_(False),
                            HrShift.status == "active",
                        )
                    ).all()
                )
        except ProgrammingError as exc:
            if not _is_missing_relation(exc):
                raise
            logger.warning("HR shift assignment tables missing; skipping assignment lookup")
            assignment_rows = []
        for assignment, shift in assignment_rows:
            if not self._assignment_row_active(
                assignment, shift, today=today, yesterday=yesterday, local_t=local_t
            ):
                continue
            on_duty.add(assignment.employee_id)

        return on_duty

    def is_employee_on_duty(
        self,
        ctx: TenantContext,
        employee_id: UUID,
        *,
        company_id: UUID | None = None,
        at: datetime | None = None,
    ) -> bool:
        return employee_id in self.list_on_duty_employee_ids(ctx, company_id=company_id, at=at)

    @staticmethod
    def _to_business_local(value: datetime) -> datetime:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        offset = timedelta(minutes=int(settings.service_business_utc_offset_minutes))
        return value.astimezone(timezone(offset))

    @classmethod
    def _roster_row_active(
        cls,
        entry: HrRosterEntry,
        shift: HrShift,
        *,
        today: date,
        yesterday: date,
        local_t: time,
    ) -> bool:
        overnight = bool(shift.is_overnight) or shift.start_time > shift.end_time
        if entry.roster_date == today:
            return shift_covers_local_time(
                shift.start_time, shift.end_time, is_overnight=overnight, local_time=local_t
            )
        # Yesterday's overnight shift still covering early morning today.
        if entry.roster_date == yesterday and overnight:
            return local_t <= shift.end_time
        return False

    @classmethod
    def _assignment_row_active(
        cls,
        assignment: HrShiftAssignment,
        shift: HrShift,
        *,
        today: date,
        yesterday: date,
        local_t: time,
    ) -> bool:
        overnight = bool(shift.is_overnight) or shift.start_time > shift.end_time
        effective_to = assignment.effective_to
        covers_today = assignment.effective_from <= today and (
            effective_to is None or effective_to >= today
        )
        covers_yesterday = assignment.effective_from <= yesterday and (
            effective_to is None or effective_to >= yesterday
        )
        if covers_today and shift_covers_local_time(
            shift.start_time, shift.end_time, is_overnight=overnight, local_time=local_t
        ):
            return True
        if overnight and covers_yesterday and local_t <= shift.end_time:
            return True
        return False
