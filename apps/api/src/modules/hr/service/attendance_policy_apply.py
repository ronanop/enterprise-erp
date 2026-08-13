"""Apply company / management-group attendance rules to attendance rows."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.attendance_rule import HrAttendanceRule
from modules.hr.repository.attendance_rule_repository import AttendanceRuleRepository
from modules.hr.repository.employment_repository import EmploymentRepository
from modules.hr.repository.management_group_repository import ManagementGroupRepository
from modules.hr.repository.shift_repository import ShiftRepository
from modules.hr.service.engines import AttendanceEngine
from modules.hr.service.engines.calendar_rules import (
    aggregate_biometric_punches,
    pick_arrival_window,
    resolve_arrival_status,
    resolve_status_from_hours,
)

_STATUSES_SKIP_RECALC = frozenset(
    {"absent", "holiday", "week_off", "miss_punch", "on_duty", "work_from_home"}
)


def _parse_dt(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


class AttendancePolicyApplyService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._rules = AttendanceRuleRepository(db)
        self._employment = EmploymentRepository(db)
        self._mgmt = ManagementGroupRepository(db)
        self._shifts = ShiftRepository(db)
        self._engine = AttendanceEngine()

    def resolve_rule_for_employee(
        self,
        ctx: TenantContext,
        company_id: UUID,
        employee_id: UUID,
    ) -> HrAttendanceRule | None:
        for emp in self._employment.list_rows(ctx, company_id):
            if emp.employee_id != employee_id:
                continue
            if emp.management_group_id:
                group = self._mgmt.get(ctx, emp.management_group_id)
                if group and group.default_attendance_rule_id:
                    rule = self._rules.get(ctx, group.default_attendance_rule_id)
                    if rule is not None and rule.status == "active":
                        return rule
            break
        return self._rules.get_default(ctx, company_id)

    def _shift_context(
        self,
        ctx: TenantContext,
        *,
        shift_id: UUID | None,
    ) -> tuple[object | None, int, str | None, str | None]:
        if not shift_id:
            return None, 0, None, None
        shift = self._shifts.get(ctx, shift_id)
        if shift is None:
            return None, 0, None, None
        return shift.start_time, int(shift.grace_minutes or 0), str(shift.id), shift.shift_code

    def aggregate_punches(
        self,
        rule: HrAttendanceRule | None,
        *,
        events: list,
        check_in_at=None,
        check_out_at=None,
    ) -> dict:
        mode = getattr(rule, "punch_mode", None) if rule else "first_in_last_out"
        return aggregate_biometric_punches(
            events or [],
            punch_mode=str(mode or "first_in_last_out"),
            check_in_at=check_in_at,
            check_out_at=check_out_at,
        )

    def resolve_checkin_status(
        self,
        rule: HrAttendanceRule | None,
        *,
        check_in_at: datetime,
        shift_start=None,
        shift_grace_minutes: int = 0,
        shift_id: str | None = None,
        shift_code: str | None = None,
    ) -> tuple[str, int]:
        if rule is None:
            return resolve_arrival_status(
                check_in_at=check_in_at,
                shift_start=shift_start,
                grace_minutes=shift_grace_minutes,
                window=None,
            )
        window = pick_arrival_window(
            arrival_policy_enabled=bool(rule.arrival_policy_enabled),
            applies_to_all_shifts=bool(rule.applies_to_all_shifts),
            window_start=rule.arrival_window_start,
            ok_until=rule.arrival_ok_until,
            after_status=rule.arrival_after_status,
            shift_windows_json=rule.shift_windows_json,
            shift_id=shift_id,
            shift_code=shift_code,
        )
        return resolve_arrival_status(
            check_in_at=check_in_at,
            shift_start=shift_start,
            grace_minutes=shift_grace_minutes,
            late_mark_after_minutes=int(rule.late_mark_after_minutes or 15),
            window=window,
        )

    def resolve_checkout_status(
        self,
        rule: HrAttendanceRule | None,
        *,
        total_hours: Decimal | float | None,
        current_status: str | None,
        early_leave_minutes: int | None = None,
    ) -> str:
        if rule is None:
            return resolve_status_from_hours(
                total_hours=total_hours,
                half_day_hours=Decimal("4"),
                full_day_hours=Decimal("8"),
                current_status=current_status,
                early_leave_minutes=early_leave_minutes,
                early_leave_half_day_minutes=120,
            )
        return resolve_status_from_hours(
            total_hours=total_hours,
            half_day_hours=rule.half_day_hours,
            full_day_hours=rule.full_day_hours,
            current_status=current_status,
            early_leave_minutes=early_leave_minutes,
            early_leave_half_day_minutes=int(rule.early_leave_half_day_minutes or 120),
        )

    def apply_to_fields(
        self,
        ctx: TenantContext,
        company_id: UUID,
        employee_id: UUID,
        fields: dict,
        *,
        rule: HrAttendanceRule | None = None,
        punch_events: list | None = None,
    ) -> dict:
        """Mutate attendance payload with policy-derived status, hours, and late minutes."""
        out = dict(fields)
        rule = rule or self.resolve_rule_for_employee(ctx, company_id, employee_id)

        check_in = _parse_dt(out.get("check_in_at"))
        check_out = _parse_dt(out.get("check_out_at"))
        explicit_status = (out.get("attendance_status") or "").strip().lower()

        if punch_events:
            aggregated = self.aggregate_punches(
                rule,
                events=punch_events,
                check_in_at=check_in,
                check_out_at=check_out,
            )
            if aggregated.get("check_in_at"):
                check_in = _parse_dt(aggregated["check_in_at"])
                out["check_in_at"] = check_in
            if aggregated.get("check_out_at"):
                check_out = _parse_dt(aggregated["check_out_at"])
                out["check_out_at"] = check_out
            if aggregated.get("total_hours") is not None:
                out["total_hours"] = Decimal(str(aggregated["total_hours"]))

        if check_in is None and check_out is None:
            if explicit_status:
                out["attendance_status"] = explicit_status
            return out

        if explicit_status in _STATUSES_SKIP_RECALC and check_in is None and check_out is None:
            return out

        shift_id = out.get("shift_id")
        shift_uuid = UUID(str(shift_id)) if shift_id else None
        shift_start, shift_grace, shift_id_str, shift_code = self._shift_context(ctx, shift_id=shift_uuid)

        late_minutes: int | None = None
        status = explicit_status or "present"

        if check_in and explicit_status not in _STATUSES_SKIP_RECALC:
            status, late_minutes = self.resolve_checkin_status(
                rule,
                check_in_at=check_in,
                shift_start=shift_start,
                shift_grace_minutes=shift_grace,
                shift_id=shift_id_str,
                shift_code=shift_code,
            )
            out["late_minutes"] = late_minutes

        if check_in and check_out:
            total = out.get("total_hours")
            if total is None:
                total = self._engine.compute_hours(check_in, check_out)
                out["total_hours"] = total
            if explicit_status not in _STATUSES_SKIP_RECALC:
                early_leave = out.get("early_leave_minutes")
                status = self.resolve_checkout_status(
                    rule,
                    total_hours=total,
                    current_status=status,
                    early_leave_minutes=int(early_leave) if early_leave is not None else None,
                )
        elif check_out is None and check_in and explicit_status not in _STATUSES_SKIP_RECALC:
            pass

        out["attendance_status"] = status or "present"
        return out
