"""Employee self-service application logic."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from math import asin, cos, radians, sin, sqrt
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from core.config import get_settings
from core.exceptions import AppException, ConflictException, ForbiddenException, NotFoundException
from modules.ess.schemas import (
    EssAnnouncementItem,
    EssAssetItem,
    EssAttendanceResponse,
    EssBankResponse,
    EssBankUpdate,
    EssDocumentResponse,
    EssEducationItem,
    EssEducationSkillsResponse,
    EssEducationSkillsUpdate,
    EssEmergencyContactResponse,
    EssEmergencyUpdate,
    EssHolidayCalendarResponse,
    EssKycResponse,
    EssLeaveBalanceResponse,
    EssLeaveRequestCreate,
    EssLeaveRequestResponse,
    EssLeaveTypeResponse,
    EssMeResponse,
    EssNotificationResponse,
    EssPayslipDetail,
    EssPayslipSummary,
    EssPerformanceItem,
    EssPunchRequest,
    EssPunchResponse,
    EssSeparationCreate,
    EssSeparationItem,
    EssSkillItem,
    EssTeamLeaveItem,
    EssTrainingItem,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.notification import NtfEvent
from modules.hr.domain.enums import HolidayCalendarStatus
from modules.hr.models import HrRosterEntry, HrShift, HrShiftAssignment
from modules.hr.service.attendance_correction_service import AttendanceCorrectionService
from modules.hr.service.attendance_policy_service import AttendanceRuleService
from modules.hr.service.attendance_service import AttendanceService
from modules.hr.service.document_service import EmployeeDocumentService
from modules.hr.service.employee_profile_service import EmployeeProfileService
from modules.hr.service.engines.attendance_engine import compute_total_hours
from modules.hr.service.holiday_calendar_service import HolidayCalendarService
from modules.hr.service.leave_service import (
    LeaveBalanceService,
    LeaveRequestService,
    LeaveTypeService,
)
from modules.master_data.domain.entities import EmployeeEntity
from modules.master_data.repository.employee_repository import EmployeeRepository
from modules.organization.models.hierarchy import OrgLocation
from modules.payroll.service.payslip_service import PayslipService


def _business_now() -> datetime:
    """Current time in the configured business timezone (aware)."""
    try:
        tz = ZoneInfo(get_settings().app_timezone)
    except Exception:
        tz = ZoneInfo("UTC")
    return datetime.now(tz)


def _attendance_response(row) -> EssAttendanceResponse:
    return EssAttendanceResponse(
        id=row.id,
        attendance_date=row.attendance_date,
        check_in_at=getattr(row, "check_in_at", None),
        check_out_at=getattr(row, "check_out_at", None),
        total_hours=getattr(row, "total_hours", None),
        attendance_status=row.attendance_status,
        source=row.source,
        status=row.status,
    )


def _leave_request_response(row) -> EssLeaveRequestResponse:
    return EssLeaveRequestResponse(
        id=row.id,
        document_number=row.document_number,
        leave_type_id=row.leave_type_id,
        start_date=row.start_date,
        end_date=row.end_date,
        days_count=row.days_count,
        reason=getattr(row, "reason", None),
        status=row.status,
    )


def _mask_id(value: str | None, *, keep: int = 4) -> str | None:
    if value is None or value == "":
        return value
    if len(value) <= keep:
        return "*" * len(value)
    return ("*" * (len(value) - keep)) + value[-keep:]


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_m = 6_371_000.0
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)
    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    return 2 * radius_m * asin(sqrt(a))


class EssService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._employees = EmployeeRepository(db)
        self._leave_types = LeaveTypeService(db)
        self._leave_balances = LeaveBalanceService(db)
        self._leave_requests = LeaveRequestService(db)
        self._attendance = AttendanceService(db)
        self._payslips = PayslipService(db)
        self._profiles = EmployeeProfileService(db)
        self._documents = EmployeeDocumentService(db)
        self._holidays = HolidayCalendarService(db)
        self._att_rules = AttendanceRuleService(db)
        self._corrections = AttendanceCorrectionService(db)

    def resolve_employee(self, ctx: TenantContext) -> EmployeeEntity:
        employee = self._employees.get_by_user_id(ctx, ctx.user_id)
        if employee is None:
            raise NotFoundException("No employee profile linked to this user")
        return employee

    def get_me(self, ctx: TenantContext) -> EssMeResponse:
        emp = self.resolve_employee(ctx)
        return EssMeResponse(
            employee_id=emp.id,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            department_id=emp.department_id,
            employee_code=emp.employee_code,
            first_name=emp.first_name,
            last_name=emp.last_name,
            email=emp.email,
            mobile=emp.mobile,
            designation=emp.designation,
            date_of_joining=emp.date_of_joining,
            status=emp.status,
            display_name=f"{emp.first_name} {emp.last_name}".strip(),
        )

    def update_me(self, ctx: TenantContext, *, mobile: str | None = None) -> EssMeResponse:
        emp = self.resolve_employee(ctx)
        fields: dict = {}
        if mobile is not None:
            cleaned = mobile.strip()
            if len(cleaned) < 8:
                raise AppException("mobile must be at least 8 characters")
            fields["mobile"] = cleaned
        if fields:
            from modules.master_data.service.employee_service import EmployeeService

            EmployeeService(self._db).update_employee(ctx, emp.id, **fields)
        return self.get_me(ctx)

    def list_leave_types(self, ctx: TenantContext) -> list[EssLeaveTypeResponse]:
        emp = self.resolve_employee(ctx)
        rows = self._leave_types.list(ctx, emp.company_id)
        return [
            EssLeaveTypeResponse.model_validate(row)
            for row in rows
            if getattr(row, "status", "active") != "archived"
        ]

    def list_leave_balances(self, ctx: TenantContext) -> list[EssLeaveBalanceResponse]:
        emp = self.resolve_employee(ctx)
        rows = self._leave_balances.list(ctx, emp.company_id)
        return [
            EssLeaveBalanceResponse.model_validate(row)
            for row in rows
            if row.employee_id == emp.id
        ]

    def list_leave_requests(self, ctx: TenantContext) -> list[EssLeaveRequestResponse]:
        emp = self.resolve_employee(ctx)
        rows = self._leave_requests.list(ctx, emp.company_id)
        return [_leave_request_response(row) for row in rows if row.employee_id == emp.id]

    def create_leave_request(
        self, ctx: TenantContext, body: EssLeaveRequestCreate
    ) -> EssLeaveRequestResponse:
        emp = self.resolve_employee(ctx)
        row = self._leave_requests.create(
            ctx,
            branch_id=emp.branch_id,
            employee_id=emp.id,
            company_id=emp.company_id,
            leave_type_id=body.leave_type_id,
            start_date=body.start_date,
            end_date=body.end_date,
            days_count=body.days_count,
            reason=body.reason,
        )
        submitted = self._leave_requests.submit(ctx, row.id)
        return _leave_request_response(submitted)

    def list_attendance(
        self,
        ctx: TenantContext,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[EssAttendanceResponse]:
        emp = self.resolve_employee(ctx)
        rows = self._attendance.list(ctx, emp.company_id)
        result: list[EssAttendanceResponse] = []
        for row in rows:
            if row.employee_id != emp.id:
                continue
            if from_date and row.attendance_date < from_date:
                continue
            if to_date and row.attendance_date > to_date:
                continue
            result.append(_attendance_response(row))
        result.sort(key=lambda r: r.attendance_date, reverse=True)
        return result

    def _geofence_locations(self, ctx: TenantContext, emp: EmployeeEntity) -> list[OrgLocation]:
        stmt = select(OrgLocation).where(
            OrgLocation.tenant_id == ctx.tenant_id,
            OrgLocation.company_id == emp.company_id,
            OrgLocation.is_deleted.is_(False),
            OrgLocation.status == "active",
            OrgLocation.geofence_radius_meters.isnot(None),
            OrgLocation.latitude.isnot(None),
            OrgLocation.longitude.isnot(None),
        )
        rows = list(self._db.scalars(stmt).all())
        branch_rows = [r for r in rows if r.branch_id == emp.branch_id]
        return branch_rows if branch_rows else rows

    def _validate_geofence(
        self,
        ctx: TenantContext,
        emp: EmployeeEntity,
        latitude: float | None,
        longitude: float | None,
    ) -> None:
        rule = self._att_rules.get_active(ctx, emp.company_id)
        geofence_required = bool(rule and rule.geofence_required)
        locations = self._geofence_locations(ctx, emp)
        if not locations and not geofence_required:
            return
        if latitude is None or longitude is None:
            raise AppException("GPS coordinates required for punch at this location")
        if not locations:
            # Policy requires GPS but no fence configured — accept any coords.
            return
        for loc in locations:
            dist = _haversine_meters(
                float(latitude),
                float(longitude),
                float(loc.latitude),
                float(loc.longitude),
            )
            if dist <= float(loc.geofence_radius_meters):
                return
        raise ConflictException("Punch location is outside the allowed geofence")

    def _resolve_shift(self, ctx: TenantContext, emp: EmployeeEntity, day: date) -> HrShift | None:
        """Prefer published roster for the day; else active/approved shift assignment."""
        roster = self._db.scalar(
            select(HrRosterEntry).where(
                HrRosterEntry.tenant_id == ctx.tenant_id,
                HrRosterEntry.employee_id == emp.id,
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
                    HrShiftAssignment.employee_id == emp.id,
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

    @staticmethod
    def _shift_window(
        shift: HrShift, day: date, tz: ZoneInfo
    ) -> tuple[datetime, datetime]:
        start = datetime.combine(day, shift.start_time, tzinfo=tz)
        end = datetime.combine(day, shift.end_time, tzinfo=tz)
        if shift.is_overnight or end <= start:
            end = end + timedelta(days=1)
        return start, end

    def _check_in_status_fields(
        self, shift: HrShift | None, local_now: datetime
    ) -> dict:
        if shift is None:
            return {"attendance_status": "present", "shift_id": None, "late_minutes": None}
        start, _ = self._shift_window(shift, local_now.date(), local_now.tzinfo)  # type: ignore[arg-type]
        grace = int(shift.grace_minutes or 0)
        late_minutes = int((local_now - start).total_seconds() // 60) - grace
        if late_minutes > 0:
            return {
                "attendance_status": "late",
                "shift_id": shift.id,
                "late_minutes": late_minutes,
            }
        return {
            "attendance_status": "present",
            "shift_id": shift.id,
            "late_minutes": 0,
        }

    def _check_out_ot_fields(
        self,
        shift: HrShift | None,
        local_now: datetime,
        current_status: str | None,
        *,
        total_hours: Decimal | None = None,
        company_id: UUID | None = None,
        ctx: TenantContext | None = None,
    ) -> dict:
        fields: dict = {
            "attendance_status": current_status or "present",
        }
        early_leave_minutes = 0
        if shift is not None:
            _, end = self._shift_window(shift, local_now.date(), local_now.tzinfo)  # type: ignore[arg-type]
            grace = int(shift.grace_minutes or 0)
            delta_min = int((local_now - end).total_seconds() // 60)
            fields["shift_id"] = shift.id
            if delta_min > 0:
                fields["overtime_minutes"] = delta_min
                fields["early_leave_minutes"] = 0
            else:
                early = abs(delta_min) - grace
                fields["overtime_minutes"] = 0
                if early > 0:
                    fields["early_leave_minutes"] = early
                    early_leave_minutes = early
                else:
                    fields["early_leave_minutes"] = 0

        # Half-day from hours + early-leave threshold (attendance rule)
        if ctx is not None and company_id is not None:
            fields["attendance_status"] = self._att_rules.resolve_checkout_status(
                ctx,
                company_id,
                total_hours=total_hours,
                current_status=fields["attendance_status"],
                early_leave_minutes=early_leave_minutes or None,
            )
        elif early_leave_minutes >= 120 and (current_status or "present") in {"present", "late"}:
            fields["attendance_status"] = "half_day"
        return fields

    def punch(
        self,
        ctx: TenantContext,
        body: EssPunchRequest | None = None,
    ) -> EssPunchResponse:
        emp = self.resolve_employee(ctx)
        latitude = body.latitude if body else None
        longitude = body.longitude if body else None
        self._validate_geofence(ctx, emp, latitude, longitude)

        # Business-local "today" so IST midnight matches the work day employees expect.
        local_now = _business_now()
        today = local_now.date()
        # Persist timestamps in UTC (timestamptz).
        now_utc = local_now.astimezone(timezone.utc)
        geo_fields: dict = {}
        if latitude is not None and longitude is not None:
            geo_fields["latitude"] = Decimal(str(latitude))
            geo_fields["longitude"] = Decimal(str(longitude))

        shift = self._resolve_shift(ctx, emp, today)
        check_in_fields = self._check_in_status_fields(shift, local_now)

        rows = [
            row
            for row in self._attendance.list(ctx, emp.company_id)
            if row.employee_id == emp.id and row.attendance_date == today
        ]
        if not rows:
            created = self._attendance.create(
                ctx,
                branch_id=emp.branch_id,
                employee_id=emp.id,
                company_id=emp.company_id,
                attendance_date=today,
                check_in_at=now_utc,
                total_hours=None,
                source="mobile",
                **check_in_fields,
                **geo_fields,
            )
            return EssPunchResponse(
                action="check_in", attendance=_attendance_response(created)
            )

        current = rows[0]
        if getattr(current, "status", None) == "locked":
            raise ConflictException("Today's attendance is locked")
        if getattr(current, "check_out_at", None) is not None:
            raise ConflictException("Already checked out for today")

        check_in = getattr(current, "check_in_at", None)
        if check_in is None:
            updated_in = self._attendance.update(
                ctx,
                current.id,
                check_in_at=now_utc,
                total_hours=None,
                **check_in_fields,
                **geo_fields,
            )
            return EssPunchResponse(
                action="check_in", attendance=_attendance_response(updated_in)
            )

        # Freeze total hours at checkout (check-in → now).
        total_hours = compute_total_hours(check_in, now_utc)
        checkout_fields = self._check_out_ot_fields(
            shift,
            local_now,
            getattr(current, "attendance_status", None),
            total_hours=total_hours,
            company_id=emp.company_id,
            ctx=ctx,
        )
        updated = self._attendance.update(
            ctx,
            current.id,
            check_out_at=now_utc,
            total_hours=total_hours,
            **checkout_fields,
            **geo_fields,
        )
        self._maybe_credit_holiday_compoff(ctx, emp, today, updated)
        self._maybe_credit_ot_compoff(ctx, emp, today, updated)
        return EssPunchResponse(
            action="check_out", attendance=_attendance_response(updated)
        )

    def _maybe_credit_holiday_compoff(self, ctx: TenantContext, emp, today: date, attendance_row) -> None:
        """If employee worked (checked out) on a published holiday, credit 1 Comp Off day."""
        notes = str(getattr(attendance_row, "notes", None) or "")
        if "holiday_compoff_credited" in notes:
            return
        status = getattr(attendance_row, "attendance_status", None)
        if status not in {"present", "late", "on_duty", "half_day"}:
            return
        if getattr(attendance_row, "check_out_at", None) is None:
            return

        from modules.hr.service.leave_service import _holiday_dates_from_json

        holiday_dates: set[date] = set()
        for cal in self._holidays.list(ctx, emp.company_id):
            if getattr(cal, "status", None) != HolidayCalendarStatus.PUBLISHED.value:
                continue
            if int(getattr(cal, "calendar_year", 0) or 0) != today.year:
                continue
            holiday_dates |= _holiday_dates_from_json(getattr(cal, "holidays_json", None))
        if today not in holiday_dates:
            return

        try:
            self._leave_balances.credit_compoff(
                ctx,
                branch_id=emp.branch_id,
                employee_id=emp.id,
                days=Decimal("1"),
                company_id=emp.company_id,
                reason=f"holiday_work:{today.isoformat()}",
                earned_date=today,
            )
            marker = "holiday_compoff_credited"
            new_notes = f"{notes} | {marker}".strip(" |") if notes else marker
            self._attendance.update(ctx, attendance_row.id, notes=new_notes)
        except Exception:
            pass

    def _maybe_credit_ot_compoff(self, ctx: TenantContext, emp, today: date, attendance_row) -> None:
        """Credit Comp Off from OT / week-off hours using attendance-rule thresholds."""
        notes = str(getattr(attendance_row, "notes", None) or "")
        if "ot_compoff_credited" in notes or "holiday_compoff_credited" in notes:
            return
        if getattr(attendance_row, "check_out_at", None) is None:
            return

        rule = self._att_rules.get_active(ctx, emp.company_id)
        if rule is None or not bool(getattr(rule, "compoff_auto_credit", True)):
            return

        ot_minutes = int(getattr(attendance_row, "overtime_minutes", 0) or 0)
        hours = (Decimal(ot_minutes) / Decimal("60")).quantize(Decimal("0.01"))

        # Week-off work: use total hours when OT minutes were not computed (no shift)
        if hours <= 0:
            try:
                from modules.hr.service.attendance_policy_service import WeeklyOffPolicyService

                if WeeklyOffPolicyService(self._db).is_off_day(ctx, emp.company_id, today):
                    total = getattr(attendance_row, "total_hours", None)
                    if total is not None:
                        hours = Decimal(str(total))
            except Exception:
                pass

        if hours <= 0:
            return

        half = Decimal(str(getattr(rule, "compoff_half_day_hours", 4) or 4))
        full = Decimal(str(getattr(rule, "compoff_full_day_hours", 8) or 8))
        if hours >= full:
            days = Decimal("1")
        elif hours >= half:
            days = Decimal("0.5")
        else:
            return

        try:
            self._leave_balances.credit_compoff(
                ctx,
                branch_id=emp.branch_id,
                employee_id=emp.id,
                days=days,
                company_id=emp.company_id,
                reason=f"ot_hours:{hours}:{today.isoformat()}",
                earned_date=today,
            )
            marker = "ot_compoff_credited"
            new_notes = f"{notes} | {marker}".strip(" |") if notes else marker
            self._attendance.update(ctx, attendance_row.id, notes=new_notes)
        except Exception:
            pass

    def list_on_duty(self, ctx: TenantContext):
        from modules.hr.service.on_duty_ot_service import OnDutyRequestService

        emp = self.resolve_employee(ctx)
        rows = OnDutyRequestService(self._db).list(ctx, emp.company_id)
        return [r for r in rows if r.employee_id == emp.id]

    def create_on_duty(
        self,
        ctx: TenantContext,
        *,
        duty_date: date,
        end_date: date | None = None,
        portion: str = "full_day",
        duty_location: str | None = None,
        purpose: str | None = None,
        reason: str | None = None,
    ):
        from modules.hr.service.on_duty_ot_service import OnDutyRequestService

        emp = self.resolve_employee(ctx)
        svc = OnDutyRequestService(self._db)
        row = svc.create(
            ctx,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            employee_id=emp.id,
            duty_date=duty_date,
            end_date=end_date,
            portion=portion,
            duty_location=duty_location,
            purpose=purpose,
            reason=reason,
            status="draft",
        )
        return svc.submit(ctx, row.id)

    def list_compoff(self, ctx: TenantContext):
        from modules.hr.service.compoff_bio_service import CompoffRequestService

        emp = self.resolve_employee(ctx)
        rows = CompoffRequestService(self._db).list(ctx, emp.company_id)
        return [r for r in rows if r.employee_id == emp.id]

    def create_compoff(
        self,
        ctx: TenantContext,
        *,
        earned_date: date,
        extra_hours: float,
        requested_days: float | None = None,
        reason: str | None = None,
    ):
        from decimal import Decimal

        from modules.hr.service.compoff_bio_service import CompoffRequestService

        emp = self.resolve_employee(ctx)
        svc = CompoffRequestService(self._db)
        row = svc.create(
            ctx,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            employee_id=emp.id,
            earned_date=earned_date,
            extra_hours=Decimal(str(extra_hours)),
            requested_days=Decimal(str(requested_days)) if requested_days is not None else None,
            reason=reason,
            status="draft",
        )
        return svc.submit(ctx, row.id)

    def register_device_token(self, ctx: TenantContext, *, token: str, platform: str = "web"):
        from modules.foundation.service.notification_service import NotificationService

        if ctx.user_id is None:
            raise AppException("Authenticated user required")
        return NotificationService(self._db).register_device_token(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            token=token,
            platform=platform,
            created_by=ctx.user_id,
        )

    def list_corrections(self, ctx: TenantContext):
        emp = self.resolve_employee(ctx)
        rows = self._corrections.list(ctx, emp.company_id)
        return [r for r in rows if r.employee_id == emp.id]

    def create_correction(
        self,
        ctx: TenantContext,
        *,
        attendance_date: date,
        field_name: str,
        new_value: str,
        reason: str | None = None,
        attendance_id: UUID | None = None,
        old_value: str | None = None,
        submit: bool = True,
    ):
        emp = self.resolve_employee(ctx)
        rule = self._att_rules.get_active(ctx, emp.company_id)
        window_h = int(rule.miss_punch_window_hours) if rule else 48
        today = _business_now().date()
        age_hours = (today - attendance_date).days * 24
        if age_hours > window_h and attendance_date < today:
            # Allow same-day; otherwise enforce window in days (hours/24).
            max_days = max(1, window_h // 24)
            if (today - attendance_date).days > max_days:
                raise AppException(
                    f"Miss-punch / correction window is {max_days} day(s); date is too old"
                )

        # V2: max 3 regularization / miss-punch requests per calendar year
        year_count = 0
        for corr in self._corrections.list(ctx, emp.company_id):
            if corr.employee_id != emp.id:
                continue
            if getattr(corr, "attendance_date", None) is None:
                continue
            if corr.attendance_date.year != attendance_date.year:
                continue
            if corr.status in {"draft", "submitted", "approved"}:
                year_count += 1
        if year_count >= 3:
            raise AppException(
                "Maximum 3 miss-punch / regularization requests allowed per calendar year"
            )

        row = self._corrections.create(
            ctx,
            branch_id=emp.branch_id,
            employee_id=emp.id,
            company_id=emp.company_id,
            attendance_date=attendance_date,
            field_name=field_name,
            new_value=new_value,
            attendance_id=attendance_id,
            old_value=old_value,
            reason=reason or "Miss punch / attendance correction",
            status="draft",
        )
        if submit:
            row = self._corrections.submit(ctx, row.id)
        return row

    def get_bank(self, ctx: TenantContext) -> EssBankResponse:
        emp = self.resolve_employee(ctx)
        profile = self._profiles.get_orm_by_employee_id(ctx, emp.id)
        return EssBankResponse(
            bank_account_number=getattr(profile, "bank_account_number", None),
            bank_ifsc=getattr(profile, "bank_ifsc", None),
            bank_name=getattr(profile, "bank_name", None),
            bank_account_holder=getattr(profile, "bank_account_holder", None),
        )

    def update_bank(self, ctx: TenantContext, body: EssBankUpdate) -> EssBankResponse:
        emp = self.resolve_employee(ctx)
        profile = self._profiles.get_orm_by_employee_id(ctx, emp.id)
        fields = body.model_dump(exclude_unset=True)
        if not fields:
            return self.get_bank(ctx)
        self._profiles.update(ctx, profile.id, **fields)
        return self.get_bank(ctx)

    def get_kyc(self, ctx: TenantContext) -> EssKycResponse:
        emp = self.resolve_employee(ctx)
        profile = self._profiles.get_orm_by_employee_id(ctx, emp.id)
        return EssKycResponse(
            aadhaar_number=_mask_id(getattr(profile, "aadhaar_number", None)),
            pan_number=_mask_id(getattr(profile, "pan_number", None)),
            uan_number=getattr(profile, "uan_number", None),
        )

    def list_documents(self, ctx: TenantContext) -> list[EssDocumentResponse]:
        emp = self.resolve_employee(ctx)
        rows = self._documents.list(ctx, emp.company_id)
        return [
            EssDocumentResponse.model_validate(row)
            for row in rows
            if row.employee_id == emp.id and getattr(row, "status", "active") != "archived"
        ]

    def list_holidays(self, ctx: TenantContext) -> list[EssHolidayCalendarResponse]:
        emp = self.resolve_employee(ctx)
        rows = self._holidays.list(ctx, emp.company_id)
        published = HolidayCalendarStatus.PUBLISHED.value
        return [
            EssHolidayCalendarResponse.model_validate(row)
            for row in rows
            if row.status == published
            and (row.branch_id is None or row.branch_id == emp.branch_id)
        ]

    def list_notifications(self, ctx: TenantContext) -> list[EssNotificationResponse]:
        emp = self.resolve_employee(ctx)
        if not emp.user_id:
            return []
        rows = list(
            self._db.scalars(
                select(NtfEvent)
                .where(
                    NtfEvent.tenant_id == ctx.tenant_id,
                    NtfEvent.recipient_user_id == emp.user_id,
                )
                .order_by(NtfEvent.created_at.desc())
                .limit(50)
            ).all()
        )
        out: list[EssNotificationResponse] = []
        for row in rows:
            payload = row.payload_json or {}
            out.append(
                EssNotificationResponse(
                    id=row.id,
                    title=str(payload.get("title") or row.event_type),
                    body=str(payload.get("body") or ""),
                    kind=str(payload.get("kind") or row.event_type),
                    read=row.status in {"delivered", "read"},
                    created_at=row.created_at,
                )
            )
        return out

    def list_payslips(self, ctx: TenantContext) -> list[EssPayslipSummary]:
        emp = self.resolve_employee(ctx)
        rows = self._payslips.list(ctx, emp.company_id)
        return [
            EssPayslipSummary(
                id=row.id,
                document_number=row.document_number,
                employee_code=row.employee_code,
                employee_name=row.employee_name,
                payroll_period_id=row.payroll_period_id,
                gross_salary=row.gross_salary,
                total_deductions=row.total_deductions,
                net_salary=row.net_salary,
                issued_at=row.issued_at,
                delivery_status=row.delivery_status,
                payment_status=row.payment_status,
                status=row.status,
            )
            for row in rows
            if row.employee_id == emp.id
        ]

    def get_payslip(self, ctx: TenantContext, payslip_id: UUID) -> EssPayslipDetail:
        emp = self.resolve_employee(ctx)
        row = self._payslips.get(ctx, payslip_id)
        if row.employee_id != emp.id:
            raise ForbiddenException("Payslip does not belong to this employee")
        return EssPayslipDetail(
            id=row.id,
            document_number=row.document_number,
            employee_code=row.employee_code,
            employee_name=row.employee_name,
            payroll_period_id=row.payroll_period_id,
            gross_salary=row.gross_salary,
            total_deductions=row.total_deductions,
            net_salary=row.net_salary,
            issued_at=row.issued_at,
            delivery_status=row.delivery_status,
            payment_status=row.payment_status,
            status=row.status,
            payslip_json=row.payslip_json,
            company_id=row.company_id,
            branch_id=row.branch_id,
        )

    def get_emergency(self, ctx: TenantContext) -> EssEmergencyContactResponse:
        emp = self.resolve_employee(ctx)
        profile = self._profiles.get_orm_by_employee_id(ctx, emp.id)
        return EssEmergencyContactResponse(
            name=getattr(profile, "emergency_contact_name", None),
            mobile=getattr(profile, "emergency_contact_mobile", None),
            blood_group=getattr(profile, "blood_group", None),
            relationship=None,
        )

    def update_emergency(self, ctx: TenantContext, body: EssEmergencyUpdate) -> EssEmergencyContactResponse:
        emp = self.resolve_employee(ctx)
        profile = self._profiles.get_orm_by_employee_id(ctx, emp.id)
        fields = body.model_dump(exclude_unset=True)
        if fields:
            self._profiles.update(ctx, profile.id, **fields)
        return self.get_emergency(ctx)

    def _parse_education(self, raw) -> list[EssEducationItem]:
        items = raw if isinstance(raw, list) else (raw.get("items") if isinstance(raw, dict) else []) or []
        out: list[EssEducationItem] = []
        for i, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            degree = str(item.get("degree") or item.get("qualification") or "").strip()
            if not degree:
                continue
            out.append(
                EssEducationItem(
                    id=str(item.get("id") or f"edu-{i}"),
                    degree=degree,
                    institution=item.get("institution") or item.get("school"),
                    field_of_study=item.get("field_of_study") or item.get("field"),
                    start_year=item.get("start_year"),
                    end_year=item.get("end_year") or item.get("year"),
                    grade=item.get("grade"),
                )
            )
        return out

    def _parse_skills(self, raw) -> list[EssSkillItem]:
        items = raw if isinstance(raw, list) else (raw.get("items") if isinstance(raw, dict) else []) or []
        out: list[EssSkillItem] = []
        for i, item in enumerate(items):
            if isinstance(item, str):
                name = item.strip()
                if name:
                    out.append(EssSkillItem(id=f"sk-{i}", name=name))
                continue
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or item.get("skill") or "").strip()
            if not name:
                continue
            years = item.get("years")
            out.append(
                EssSkillItem(
                    id=str(item.get("id") or f"sk-{i}"),
                    name=name,
                    level=item.get("level"),
                    years=float(years) if years is not None else None,
                )
            )
        return out

    def get_education_skills(self, ctx: TenantContext) -> EssEducationSkillsResponse:
        emp = self.resolve_employee(ctx)
        profile = self._profiles.get_orm_by_employee_id(ctx, emp.id)
        return EssEducationSkillsResponse(
            education=self._parse_education(getattr(profile, "education_json", None)),
            skills=self._parse_skills(getattr(profile, "skills_json", None)),
        )

    def update_education_skills(
        self, ctx: TenantContext, body: EssEducationSkillsUpdate
    ) -> EssEducationSkillsResponse:
        emp = self.resolve_employee(ctx)
        profile = self._profiles.get_orm_by_employee_id(ctx, emp.id)
        fields: dict = {}
        if body.education is not None:
            fields["education_json"] = [e.model_dump() for e in body.education]
        if body.skills is not None:
            fields["skills_json"] = [s.model_dump() for s in body.skills]
        if fields:
            self._profiles.update(ctx, profile.id, **fields)
        return self.get_education_skills(ctx)

    def list_team_leave(self, ctx: TenantContext) -> list[EssTeamLeaveItem]:
        from modules.master_data.models.employee import MasterEmployee

        emp = self.resolve_employee(ctx)
        reports = list(
            self._db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.reporting_manager_id == emp.id,
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all()
        )
        if not reports:
            return []
        report_ids = {r.id for r in reports}
        by_id = {r.id: r for r in reports}
        leaves = self._leave_requests.list(ctx, emp.company_id)
        out: list[EssTeamLeaveItem] = []
        for row in leaves:
            if row.employee_id not in report_ids:
                continue
            if row.status in {"cancelled", "rejected", "draft"}:
                continue
            member = by_id[row.employee_id]
            out.append(
                EssTeamLeaveItem(
                    id=row.id,
                    employee_id=row.employee_id,
                    employee_code=member.employee_code,
                    display_name=f"{member.first_name} {member.last_name}".strip(),
                    document_number=row.document_number,
                    start_date=row.start_date,
                    end_date=row.end_date,
                    days_count=row.days_count,
                    status=row.status,
                )
            )
        return out

    def manager_approve_team_leave(self, ctx: TenantContext, row_id: UUID):
        from modules.master_data.models.employee import MasterEmployee

        emp = self.resolve_employee(ctx)
        row = self._leave_requests.get(ctx, row_id)
        reports = {
            r.id
            for r in self._db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.reporting_manager_id == emp.id,
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all()
        }
        if row.employee_id not in reports:
            raise ForbiddenException("Not a direct report leave request")
        return self._leave_requests.manager_approve(ctx, row_id, approver_employee_id=emp.id)

    def reject_team_leave(self, ctx: TenantContext, row_id: UUID):
        from modules.master_data.models.employee import MasterEmployee

        emp = self.resolve_employee(ctx)
        row = self._leave_requests.get(ctx, row_id)
        reports = {
            r.id
            for r in self._db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.reporting_manager_id == emp.id,
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all()
        }
        if row.employee_id not in reports:
            raise ForbiddenException("Not a direct report leave request")
        return self._leave_requests.reject(ctx, row_id, approver_employee_id=emp.id)

    def list_announcements(self, ctx: TenantContext) -> list[EssAnnouncementItem]:
        """Holiday-derived announcements until a dedicated announcements module exists."""
        calendars = self.list_holidays(ctx)
        today = date.today()
        out: list[EssAnnouncementItem] = []
        for cal in calendars:
            holidays = cal.holidays_json or []
            if isinstance(holidays, dict):
                holidays = holidays.get("days") or holidays.get("holidays") or []
            if not isinstance(holidays, list):
                continue
            for idx, item in enumerate(holidays):
                if isinstance(item, str):
                    out.append(
                        EssAnnouncementItem(
                            id=f"{cal.id}-{idx}",
                            title=item,
                            body=f"Holiday on company calendar {cal.calendar_name}",
                            tag="Events",
                            pinned=False,
                            published_on=None,
                        )
                    )
                    continue
                if not isinstance(item, dict):
                    continue
                raw_date = item.get("date") or item.get("holiday_date")
                try:
                    hdate = date.fromisoformat(str(raw_date)[:10]) if raw_date else None
                except ValueError:
                    hdate = None
                if hdate and hdate < today:
                    continue
                name = str(item.get("name") or item.get("title") or "Holiday")
                out.append(
                    EssAnnouncementItem(
                        id=f"{cal.id}-{idx}",
                        title=name,
                        body=str(item.get("description") or f"Upcoming holiday ({cal.calendar_name})"),
                        tag="Events",
                        pinned=hdate == today if hdate else False,
                        published_on=hdate,
                    )
                )
        return out[:30]

    def list_assets(self, ctx: TenantContext) -> list[EssAssetItem]:
        from modules.asset.models.asset import AstAsset
        from modules.asset.models.asset_assignment import AstAssetAssignment

        emp = self.resolve_employee(ctx)
        assignments = list(
            self._db.scalars(
                select(AstAssetAssignment).where(
                    AstAssetAssignment.employee_id == emp.id,
                    AstAssetAssignment.is_deleted.is_(False),
                    AstAssetAssignment.status.in_(("active", "approved")),
                )
            ).all()
        )
        out: list[EssAssetItem] = []
        for asn in assignments:
            asset = self._db.get(AstAsset, asn.asset_id)
            if asset is None or getattr(asset, "is_deleted", False):
                continue
            out.append(
                EssAssetItem(
                    id=asset.id,
                    asset_code=asset.asset_code,
                    asset_name=asset.asset_name,
                    asset_type=asset.asset_type,
                    serial_number=asset.serial_number,
                    status=asset.status,
                    assignment_status=asn.status,
                )
            )
        if out:
            return out
        # Fallback: assets where employee is custodian
        custodians = list(
            self._db.scalars(
                select(AstAsset).where(
                    AstAsset.custodian_employee_id == emp.id,
                    AstAsset.is_deleted.is_(False),
                )
            ).all()
        )
        return [
            EssAssetItem(
                id=a.id,
                asset_code=a.asset_code,
                asset_name=a.asset_name,
                asset_type=a.asset_type,
                serial_number=a.serial_number,
                status=a.status,
                assignment_status="custodian",
            )
            for a in custodians
        ]

    def list_training(self, ctx: TenantContext) -> list[EssTrainingItem]:
        from modules.hr.service.training_service import TrainingAttendanceService, TrainingService

        emp = self.resolve_employee(ctx)
        attendance = TrainingAttendanceService(self._db).list(ctx, emp.company_id)
        trainings = {t.id: t for t in TrainingService(self._db).list(ctx, emp.company_id)}
        out: list[EssTrainingItem] = []
        for row in attendance:
            if row.employee_id != emp.id:
                continue
            trn = trainings.get(row.training_id)
            out.append(
                EssTrainingItem(
                    id=row.id,
                    training_id=row.training_id,
                    training_code=getattr(trn, "training_code", "") or "",
                    training_name=getattr(trn, "training_name", "") or "Training",
                    training_type=getattr(trn, "training_type", None),
                    start_date=getattr(trn, "start_date", None),
                    attendance_status=getattr(row, "attendance_status", None) or row.status,
                    status=getattr(trn, "status", None) or row.status,
                )
            )
        return out

    def list_performance(self, ctx: TenantContext) -> list[EssPerformanceItem]:
        from modules.hr.service.performance_service import PerformanceService

        emp = self.resolve_employee(ctx)
        rows = PerformanceService(self._db).list(ctx, emp.company_id)
        return [
            EssPerformanceItem(
                id=row.id,
                document_number=row.document_number,
                review_cycle=row.review_cycle,
                period_start=getattr(row, "period_start", None),
                period_end=getattr(row, "period_end", None),
                overall_rating=getattr(row, "overall_rating", None),
                status=row.status,
            )
            for row in rows
            if row.employee_id == emp.id
        ]

    def list_separation(self, ctx: TenantContext) -> list[EssSeparationItem]:
        from modules.hr.service.separation_service import SeparationService

        emp = self.resolve_employee(ctx)
        rows = SeparationService(self._db).list(ctx, emp.company_id)
        return [
            EssSeparationItem(
                id=row.id,
                document_number=row.document_number,
                separation_type=row.separation_type,
                requested_last_working_date=row.requested_last_working_date,
                status=row.status,
                fnf_status=getattr(row, "fnf_status", None),
            )
            for row in rows
            if row.employee_id == emp.id
        ]

    def create_separation(self, ctx: TenantContext, body: EssSeparationCreate) -> EssSeparationItem:
        from modules.hr.service.separation_service import SeparationService

        emp = self.resolve_employee(ctx)
        row = SeparationService(self._db).create(
            ctx,
            branch_id=emp.branch_id,
            employee_id=emp.id,
            company_id=emp.company_id,
            separation_type=body.separation_type,
            requested_last_working_date=body.requested_last_working_date,
            reason=body.reason,
        )
        return EssSeparationItem(
            id=row.id,
            document_number=row.document_number,
            separation_type=row.separation_type,
            requested_last_working_date=row.requested_last_working_date,
            status=row.status,
            fnf_status=getattr(row, "fnf_status", None),
        )
