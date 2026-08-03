"""Weekly-off policy + attendance rule services."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.domain.enums import HolidayCalendarStatus
from modules.hr.repository.attendance_rule_repository import AttendanceRuleRepository
from modules.hr.repository.holiday_calendar_repository import HolidayCalendarRepository
from modules.hr.repository.weekly_off_policy_repository import WeeklyOffPolicyRepository
from modules.hr.service.engines.calendar_rules import (
    aggregate_biometric_punches,
    holiday_dates_from_json,
    is_weekly_off_day,
    pick_arrival_window,
    resolve_arrival_status,
    resolve_status_from_hours,
)
from modules.hr.service.attendance_policy_apply import AttendancePolicyApplyService
from modules.hr.service.hr_scope_validator import HrScopeValidator

_ALLOWED_RULES = {
    "sunday",
    "saturday",
    "alternate_saturday",
    "second_saturday",
    "rotating",
    "custom",
}


class WeeklyOffPolicyService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = WeeklyOffPolicyRepository(db)
        self._scope = HrScopeValidator(db)
        self._holidays = HolidayCalendarRepository(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Weekly-off policy not found")
        return row

    def get_active(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.get_default(ctx, cid)

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id or fields.pop("company_id", None))
        rules = fields.get("rules_json") or ["sunday"]
        if not isinstance(rules, list):
            raise AppException("rules_json must be a list")
        bad = [r for r in rules if str(r).lower() not in _ALLOWED_RULES]
        if bad:
            raise AppException(f"Invalid weekly-off rules: {bad}")
        fields["rules_json"] = [str(r).lower() for r in rules]
        fields.setdefault("policy_code", "WOFF-001")
        fields.setdefault("policy_name", "Default Weekly Off")
        fields.setdefault("status", "active")
        fields.setdefault("is_default", True)
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        if "rules_json" in fields and fields["rules_json"] is not None:
            rules = fields["rules_json"]
            if not isinstance(rules, list):
                raise AppException("rules_json must be a list")
            bad = [r for r in rules if str(r).lower() not in _ALLOWED_RULES]
            if bad:
                raise AppException(f"Invalid weekly-off rules: {bad}")
            fields["rules_json"] = [str(r).lower() for r in rules]
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Weekly-off policy not found")
        return row

    def upsert_rules(
        self,
        ctx: TenantContext,
        rules: list[str],
        *,
        company_id: UUID | None = None,
        custom_weekdays: list[int] | None = None,
        alternate_saturday_start: date | None = None,
    ):
        """Create or update the company default weekly-off policy from a rule list."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        existing = self._repo.get_default(ctx, cid)
        payload = {
            "rules_json": rules,
            "custom_weekdays_json": custom_weekdays,
            "alternate_saturday_start": alternate_saturday_start,
            "status": "active",
            "is_default": True,
        }
        if existing is None:
            return self.create(ctx, company_id=cid, **payload)
        return self.update(ctx, existing.id, **payload)

    def is_off_day(self, ctx: TenantContext, company_id: UUID, day: date) -> bool:
        policy = self._repo.get_default(ctx, company_id)
        if policy is None:
            return is_weekly_off_day(day, None)
        return is_weekly_off_day(
            day,
            policy.rules_json,
            custom_weekdays=policy.custom_weekdays_json,
            alternate_start=policy.alternate_saturday_start,
        )

    def published_holidays(self, ctx: TenantContext, company_id: UUID, year: int) -> set[date]:
        out: set[date] = set()
        for cal in self._holidays.list_rows(ctx, company_id):
            if cal.status != HolidayCalendarStatus.PUBLISHED.value:
                continue
            if int(cal.calendar_year or 0) != year:
                continue
            out |= holiday_dates_from_json(cal.holidays_json)
        return out

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Weekly-off policy not found")


class AttendanceRuleService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = AttendanceRuleRepository(db)
        self._scope = HrScopeValidator(db)

    @staticmethod
    def _normalize_time_field(value):
        if value is None or value == "":
            return None
        if hasattr(value, "hour"):
            return value
        raw = str(value).strip()
        if len(raw) == 5:
            raw = f"{raw}:00"
        from datetime import time as time_cls

        parts = raw.split(":")
        return time_cls(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0, int(parts[2]) if len(parts) > 2 else 0)

    @staticmethod
    def _normalize_windows(value):
        if value is None:
            return None
        if isinstance(value, list):
            out = []
            for row in value:
                if hasattr(row, "model_dump"):
                    out.append(row.model_dump())
                elif isinstance(row, dict):
                    out.append(row)
            return out
        return value

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Attendance rule not found")
        return row

    def get_active(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.get_default(ctx, cid)

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id or fields.pop("company_id", None))
        fields.setdefault("rule_code", fields.pop("code", None) or "AR-001")
        name = fields.pop("name", None) or fields.get("rule_name") or "Default Attendance Rule"
        fields["rule_name"] = name
        # Map UI keys
        if "late_mark_after" in fields and "late_mark_after_minutes" not in fields:
            fields["late_mark_after_minutes"] = fields.pop("late_mark_after")
        fields.pop("late_mark_after", None)
        if "arrival_window_start" in fields:
            fields["arrival_window_start"] = self._normalize_time_field(fields["arrival_window_start"])
        if "arrival_ok_until" in fields:
            fields["arrival_ok_until"] = self._normalize_time_field(fields["arrival_ok_until"])
        if "shift_windows_json" in fields:
            fields["shift_windows_json"] = self._normalize_windows(fields["shift_windows_json"])
        if "punch_mode" in fields and fields["punch_mode"]:
            fields["punch_mode"] = str(fields["punch_mode"]).lower()
        if "arrival_after_status" in fields and fields["arrival_after_status"]:
            fields["arrival_after_status"] = str(fields["arrival_after_status"]).lower()
        fields.setdefault("status", "active")
        fields.setdefault("is_default", True)
        fields.setdefault("half_day_hours", Decimal("4.00"))
        fields.setdefault("full_day_hours", Decimal("8.00"))
        fields.setdefault("punch_mode", "first_in_last_out")
        row = self._repo.create(ctx, company_id=cid, **fields)
        if row.is_default:
            self._clear_other_defaults(ctx, cid, row.id)
        return row

    def _clear_other_defaults(self, ctx: TenantContext, company_id: UUID, keep_id: UUID) -> None:
        for other in self._repo.list_rows(ctx, company_id):
            if other.id != keep_id and other.is_default:
                self._repo.update(ctx, other.id, is_default=False)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        if "name" in fields and fields["name"] is not None:
            fields["rule_name"] = fields.pop("name")
        if "code" in fields:
            fields.pop("code")
        if "late_mark_after" in fields and fields["late_mark_after"] is not None:
            fields["late_mark_after_minutes"] = fields.pop("late_mark_after")
        fields.pop("late_mark_after", None)
        if "arrival_window_start" in fields:
            fields["arrival_window_start"] = self._normalize_time_field(fields["arrival_window_start"])
        if "arrival_ok_until" in fields:
            fields["arrival_ok_until"] = self._normalize_time_field(fields["arrival_ok_until"])
        if "shift_windows_json" in fields:
            fields["shift_windows_json"] = self._normalize_windows(fields["shift_windows_json"])
        if "punch_mode" in fields and fields["punch_mode"]:
            fields["punch_mode"] = str(fields["punch_mode"]).lower()
        if "arrival_after_status" in fields and fields["arrival_after_status"]:
            fields["arrival_after_status"] = str(fields["arrival_after_status"]).lower()
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Attendance rule not found")
        if row.is_default:
            self._clear_other_defaults(ctx, row.company_id, row.id)
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Attendance rule not found")

    def resolve_checkin_status(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        check_in_at,
        shift_start=None,
        shift_grace_minutes: int = 0,
        shift_id: str | None = None,
        shift_code: str | None = None,
        employee_id: UUID | None = None,
    ) -> tuple[str, int]:
        apply_svc = AttendancePolicyApplyService(self._db)
        rule = (
            apply_svc.resolve_rule_for_employee(ctx, company_id, employee_id)
            if employee_id
            else self._repo.get_default(ctx, company_id)
        )
        if isinstance(check_in_at, str):
            check_in_at = datetime.fromisoformat(str(check_in_at).replace("Z", "+00:00"))
        return apply_svc.resolve_checkin_status(
            rule,
            check_in_at=check_in_at,
            shift_start=shift_start,
            shift_grace_minutes=shift_grace_minutes,
            shift_id=shift_id,
            shift_code=shift_code,
        )

    def resolve_checkout_status(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        total_hours: Decimal | float | None,
        current_status: str | None,
        early_leave_minutes: int | None = None,
        employee_id: UUID | None = None,
    ) -> str:
        apply_svc = AttendancePolicyApplyService(self._db)
        rule = (
            apply_svc.resolve_rule_for_employee(ctx, company_id, employee_id)
            if employee_id
            else self._repo.get_default(ctx, company_id)
        )
        return apply_svc.resolve_checkout_status(
            rule,
            total_hours=total_hours,
            current_status=current_status,
            early_leave_minutes=early_leave_minutes,
        )

    def aggregate_punches(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        events: list,
        check_in_at=None,
        check_out_at=None,
        employee_id: UUID | None = None,
    ) -> dict:
        apply_svc = AttendancePolicyApplyService(self._db)
        rule = (
            apply_svc.resolve_rule_for_employee(ctx, company_id, employee_id)
            if employee_id
            else self._repo.get_default(ctx, company_id)
        )
        return apply_svc.aggregate_punches(
            rule,
            events=events,
            check_in_at=check_in_at,
            check_out_at=check_out_at,
        )
