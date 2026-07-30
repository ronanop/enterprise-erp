"""Weekly-off policy + attendance rule services."""

from __future__ import annotations

from datetime import date
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
    holiday_dates_from_json,
    is_weekly_off_day,
    resolve_status_from_hours,
)
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
    ):
        """Create or update the company default weekly-off policy from a rule list."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        existing = self._repo.get_default(ctx, cid)
        payload = {
            "rules_json": rules,
            "custom_weekdays_json": custom_weekdays,
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
        fields.setdefault("status", "active")
        fields.setdefault("is_default", True)
        fields.setdefault("half_day_hours", Decimal("4.00"))
        fields.setdefault("full_day_hours", Decimal("8.00"))
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        if "name" in fields and fields["name"] is not None:
            fields["rule_name"] = fields.pop("name")
        if "code" in fields:
            fields.pop("code")
        if "late_mark_after" in fields and fields["late_mark_after"] is not None:
            fields["late_mark_after_minutes"] = fields.pop("late_mark_after")
        fields.pop("late_mark_after", None)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Attendance rule not found")
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Attendance rule not found")

    def resolve_checkout_status(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        total_hours: Decimal | float | None,
        current_status: str | None,
        early_leave_minutes: int | None = None,
    ) -> str:
        rule = self._repo.get_default(ctx, company_id)
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
