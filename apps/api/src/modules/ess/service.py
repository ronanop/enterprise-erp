"""Employee self-service application logic."""

import base64
import binascii
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from math import asin, cos, radians, sin, sqrt
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import get_settings
from core.exceptions import AppException, ConflictException, ForbiddenException, NotFoundException
from modules.ess.employee_document_storage import (
    DocumentDownload,
    load_document_download,
    save_employee_document_bytes,
)
from shared.text_safety import assert_safe_plain_text
from shared.upload_safety import UnsafeUploadError, validate_upload
from modules.ess.schemas import (
    EssAnnouncementItem,
    EssAssetItem,
    EssAttendanceResponse,
    EssBankResponse,
    EssBankUpdate,
    EssDocumentResponse,
    EssDocumentUploadBody,
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
    EssNotificationPollResponse,
    EssPayslipDetail,
    EssPayslipSummary,
    EssPerformanceItem,
    EssPunchRequest,
    EssPunchResponse,
    EssSeparationCreate,
    EssSeparationItem,
    EssSkillItem,
    EssTeamLeaveItem,
    EssTeamMember,
    EssTrainingItem,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.notification import NtfEvent
from modules.foundation.repository.base import utcnow
from modules.foundation.service.notification_href import sanitize_inbox_href
from modules.ess.adapters.asset_adapter import EssAssetAdapter
from modules.ess.adapters.hr_adapter import EssHrAdapter
from modules.hr.domain.enums import HolidayCalendarStatus
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
from modules.master_data.models.employee import MasterEmployee
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


def _format_address_json(raw: object | None) -> str | None:
    """Flatten HRMS address JSON (line1/city/state/…) into a single display string."""
    if raw is None:
        return None
    if isinstance(raw, str):
        text = raw.strip()
        return text or None
    if not isinstance(raw, dict):
        return None
    parts: list[str] = []
    for key in (
        "line1",
        "address_line1",
        "line2",
        "address_line2",
        "city",
        "state",
        "postal_code",
        "pincode",
        "country",
        "country_code",
    ):
        value = raw.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text and text not in parts:
            parts.append(text)
    if parts:
        return ", ".join(parts)
    # Fallback: any non-empty string values
    for value in raw.values():
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    return ", ".join(parts) if parts else None


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
        late_minutes=getattr(row, "late_minutes", None),
        overtime_minutes=getattr(row, "overtime_minutes", None),
        early_leave_minutes=getattr(row, "early_leave_minutes", None),
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


_EARNING_ALIASES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("basic", "Basic Salary", ("basic", "BASIC", "basic_salary", "basic_pay", "COMP-BASIC")),
    ("hra", "House Rent Allowance (HRA)", ("hra", "house_rent_allowance", "HRA")),
    ("special", "Special Allowance", ("special", "special_allowance", "SPECIAL")),
    ("medical", "Medical", ("medical", "MEDICAL")),
    ("conveyance", "Conveyance", ("conveyance", "CONVEYANCE")),
    ("lta", "LTA", ("lta", "LTA")),
    ("ot", "Overtime", ("ot", "overtime", "overtime_pay")),
    ("bonus", "Performance Bonus", ("bonus", "BONUS")),
    ("arrears", "Arrears", ("arrears",)),
    ("incentive", "Performance Incentive", ("incentive", "incentives")),
)

_DEDUCTION_ALIASES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    (
        "pf_employee",
        "Provident Fund (EPF)",
        ("pf_employee", "pf", "employee_pf", "ee_pf", "EE_PF", "PF"),
    ),
    ("esi", "ESI", ("esi", "esi_employee", "ESI")),
    (
        "pt",
        "Professional Tax (PT)",
        ("pt", "professional_tax", "PT"),
    ),
    (
        "tds",
        "Income Tax (TDS)",
        ("tds", "tax", "income_tax", "itax", "ITAX"),
    ),
    ("adj", "Other Deductions", ("adj", "deduction_adjustments", "other_deductions")),
)

_SKIP_DEDUCTION_CODES = {
    "pf_employer",
    "employer_pf",
    "empr_pf",
    "EMPR_PF",
    "pf_total",
}


def _money_amount(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _pick_breakdown_amount(bd: dict, aliases: tuple[str, ...]) -> float:
    lowered = {str(k).lower(): v for k, v in bd.items()}
    for alias in aliases:
        key = alias.lower()
        if key in lowered:
            amount = _money_amount(lowered[key])
            if amount:
                return amount
    return 0.0


def _normalize_money_lines(rows: list | None) -> list[dict] | None:
    if not isinstance(rows, list) or not rows:
        return None
    out: list[dict] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        code = str(row.get("code") or "").strip()
        if code.lower() in {c.lower() for c in _SKIP_DEDUCTION_CODES}:
            continue
        amount = _money_amount(row.get("amount"))
        label = str(row.get("label") or code or "Item").strip()
        if amount == 0 and not label.lower().startswith("basic"):
            continue
        out.append({"code": code or None, "label": label, "amount": amount})
    return out or None


def _lines_from_component_breakdown(
    bd: dict,
    *,
    earning_labels: dict[str, str] | None = None,
    deduction_labels: dict[str, str] | None = None,
) -> tuple[list[dict], list[dict]]:
    earning_labels = earning_labels or {}
    deduction_labels = deduction_labels or {}
    earnings: list[dict] = []
    for code, default_label, aliases in _EARNING_ALIASES:
        amount = _pick_breakdown_amount(bd, aliases)
        if amount == 0:
            continue
        label = (
            earning_labels.get(code.upper())
            or next((earning_labels[a.upper()] for a in aliases if a.upper() in earning_labels), None)
            or default_label
        )
        earnings.append({"code": code, "label": label, "amount": amount})

    deductions: list[dict] = []
    for code, default_label, aliases in _DEDUCTION_ALIASES:
        amount = _pick_breakdown_amount(bd, aliases)
        if amount == 0:
            continue
        label = (
            deduction_labels.get(code.upper())
            or next(
                (deduction_labels[a.upper()] for a in aliases if a.upper() in deduction_labels),
                None,
            )
            or default_label
        )
        # Prefer HRMS deduction-type name for PF when catalog has it.
        if code == "pf_employee" and "PF" in deduction_labels:
            label = deduction_labels["PF"]
            if "provident" in label.lower() and "epf" not in label.lower():
                label = f"{label} (EPF)"
        deductions.append({"code": code, "label": label, "amount": amount})
    return earnings, deductions


def _payslip_ess_fields(payslip_json: dict | None) -> dict:
    pj = payslip_json if isinstance(payslip_json, dict) else {}
    period_raw = pj.get("period")
    if isinstance(period_raw, dict):
        period = period_raw
        period_name = period.get("name") or period.get("code")
        period_start = period.get("start")
        period_end = period.get("end")
    elif isinstance(period_raw, str) and period_raw.strip():
        period_name = period_raw.strip()
        period_start = None
        period_end = None
    else:
        period_name = None
        period_start = None
        period_end = None
    return {
        "period_name": period_name,
        "period_start": period_start,
        "period_end": period_end,
        "export_text": pj.get("export_text"),
        "attendance_summary": pj.get("attendance") if isinstance(pj.get("attendance"), dict) else None,
        "earnings": _normalize_money_lines(pj.get("earnings") if isinstance(pj.get("earnings"), list) else None),
        "deductions": _normalize_money_lines(
            pj.get("deductions") if isinstance(pj.get("deductions"), list) else None
        ),
        "component_breakdown": (
            pj.get("component_breakdown")
            if isinstance(pj.get("component_breakdown"), dict)
            else None
        ),
    }


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

    @staticmethod
    def _notification_from_event(row: NtfEvent) -> EssNotificationResponse:
        payload = row.payload_json or {}
        kind = str(payload.get("kind") or row.event_type)
        title = str(payload.get("title") or row.event_type)
        body = str(payload.get("body") or "")
        href_raw = payload.get("href") or payload.get("action_href")
        # Prefer deep links into the request the notification is about.
        leave_id = payload.get("leave_request_id")
        correction_id = payload.get("correction_id") or payload.get(
            "attendance_correction_id"
        )
        wfh_id = payload.get("wfh_request_id")
        on_duty_id = payload.get("on_duty_request_id")
        meeting_id = payload.get("meeting_request_id") or payload.get(
            "training_request_id"
        )
        payslip_id = payload.get("payslip_id")
        title_l = title.lower()
        body_l = body.lower()
        kind_l = kind.lower()
        event_l = str(row.event_type or "").lower()
        blob = f"{title_l} {body_l} {kind_l} {event_l}"
        href_s = str(href_raw or "").strip()
        # Manager inbox: team member requests always open Team Approvals.
        is_manager_inbox = (
            href_s == "/approvals"
            or href_s.startswith("/approvals")
            or title_l.startswith("[manager]")
            or "team approvals" in blob
            or "open team approvals" in blob
            or event_l.endswith("_manager")
            or "submitted_manager" in event_l
            or any(
                k in title_l
                for k in (
                    "leave request from",
                    "wfh from",
                    "on duty from",
                    "regularization from",
                    "comp off from",
                )
            )
        )
        ess_href: str | None = None
        if is_manager_inbox:
            ess_href = "/approvals"
        elif leave_id:
            ess_href = f"/leave/{leave_id}"
        elif payslip_id:
            ess_href = f"/payslips/{payslip_id}"
        elif meeting_id or "meeting" in kind_l or "room" in kind_l:
            ess_href = "/rooms"
        elif correction_id or "miss" in kind_l or "attendance" in kind_l:
            ess_href = "/attendance/correction"
        elif wfh_id or kind_l == "wfh":
            ess_href = "/attendance/wfh"
        elif "tour" in kind_l or "travel" in kind_l:
            ess_href = "/attendance/on-tour"
        elif on_duty_id or kind_l == "on_duty":
            ess_href = "/attendance/on-duty"
        elif kind_l == "compoff" or "comp off" in blob:
            ess_href = "/attendance/compoff"
        elif (
            kind_l == "profile_update"
            or "detail update" in blob
            or "profile update" in blob
        ):
            ess_href = "/profile/personal"
        elif "payslip" in kind_l or "salary" in kind_l or "payroll" in kind_l:
            ess_href = "/payslips"
        elif "leave" in kind_l:
            ess_href = "/leave/history" if any(
                t in title_l for t in ("approv", "reject", "cancel")
            ) else "/leave"
        href = sanitize_inbox_href(ess_href or href_raw, kind=kind)
        # Never send employees to HRMS paths from ESS notifications.
        if href and str(href).startswith("/hr/"):
            href = ess_href or "/home"
        return EssNotificationResponse(
            id=row.id,
            title=title,
            body=body,
            kind=kind,
            # Only explicit read markers count — channel dispatch sets status
            # to "sent"/"delivered" without meaning the user opened the item.
            read=row.read_at is not None or row.status == "read",
            created_at=row.created_at,
            href=href,
        )

    def resolve_employee(self, ctx: TenantContext) -> EmployeeEntity:
        employee = self._employees.get_by_user_id(ctx, ctx.user_id)
        if employee is None:
            raise NotFoundException("No employee profile linked to this user")
        return employee

    def get_me(self, ctx: TenantContext) -> EssMeResponse:
        from modules.foundation.models.security import SecRole, SecUserRole, SecUser
        from modules.foundation.service.rbac_service import RBACService

        emp = self.resolve_employee(ctx)
        role_codes = list(
            self._db.scalars(
                select(SecRole.role_code)
                .join(SecUserRole, SecUserRole.role_id == SecRole.id)
                .where(
                    SecUserRole.user_id == ctx.user_id,
                    SecRole.tenant_id == ctx.tenant_id,
                    SecRole.is_deleted.is_(False),
                )
            ).all()
        )
        perms = RBACService(self._db).get_user_permissions(ctx.user_id, ctx.tenant_id)
        is_manager = bool(EssHrAdapter(self._db).list_direct_report_ids(manager_employee_id=emp.id))
        admin_roles = {"SUPER_ADMIN", "TENANT_ADMIN", "HR_MANAGER", "HR_ADMIN"}
        is_admin = bool(admin_roles.intersection(role_codes)) or "hr.leave:approve" in perms
        if is_admin:
            ess_role = "admin"
        elif is_manager:
            ess_role = "manager"
        else:
            ess_role = "employee"
        can_approve_team_leave = is_manager or "hr.leave:approve" in perms
        pending_approvals_count = (
            self.count_pending_approvals(ctx) if can_approve_team_leave else 0
        )
        user = self._db.get(SecUser, ctx.user_id)
        must_change_password = bool(user and getattr(user, "must_change_password", False))
        pending_policy_count = self._compliance().pending_policy_count(ctx)
        is_ess_admin = ess_role == "admin"

        from modules.organization.models.branch import OrgBranch
        from modules.organization.models.company import OrgCompany
        from modules.organization.models.hierarchy import OrgDepartment
        from modules.hr.models.employee_profile import HrEmployeeProfile

        department_name: str | None = None
        if emp.department_id:
            dept = self._db.get(OrgDepartment, emp.department_id)
            if dept and not getattr(dept, "is_deleted", False):
                department_name = getattr(dept, "department_name", None)

        company_name: str | None = None
        company = self._db.get(OrgCompany, emp.company_id)
        if company and not getattr(company, "is_deleted", False):
            company_name = getattr(company, "company_name", None)

        branch_name: str | None = None
        if emp.branch_id:
            branch = self._db.get(OrgBranch, emp.branch_id)
            if branch and not getattr(branch, "is_deleted", False):
                branch_name = getattr(branch, "branch_name", None)

        manager_name: str | None = None
        manager_id = getattr(emp, "reporting_manager_id", None)
        if manager_id:
            from modules.master_data.models.employee import MasterEmployee as _MasterEmployee

            manager = self._db.get(_MasterEmployee, manager_id)
            if manager and not getattr(manager, "is_deleted", False):
                manager_name = f"{manager.first_name} {manager.last_name}".strip()

        # Personal / bio fields live on hr_employee_profile (HRMS), not master_employee.
        # Load by employee_id + tenant so ESS always sees the employee's own HRMS row.
        profile = self._db.scalar(
            select(HrEmployeeProfile).where(
                HrEmployeeProfile.employee_id == emp.id,
                HrEmployeeProfile.tenant_id == ctx.tenant_id,
                HrEmployeeProfile.is_deleted.is_(False),
            )
        )

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
            department_name=department_name,
            manager_name=manager_name,
            company_name=company_name,
            branch_name=branch_name,
            date_of_birth=getattr(profile, "date_of_birth", None) if profile else None,
            gender=getattr(profile, "gender", None) if profile else None,
            marital_status=getattr(profile, "marital_status", None) if profile else None,
            nationality=getattr(profile, "nationality", None) if profile else None,
            blood_group=getattr(profile, "blood_group", None) if profile else None,
            current_address=_format_address_json(
                getattr(profile, "current_address_json", None) if profile else None
            ),
            permanent_address=_format_address_json(
                getattr(profile, "permanent_address_json", None) if profile else None
            ),
            has_profile_photo=bool(
                profile and getattr(profile, "profile_photo_uri", None)
            ),
            photo_url=(
                "/ess/me/photo"
                if profile and getattr(profile, "profile_photo_uri", None)
                else None
            ),
            role_codes=role_codes,
            ess_role=ess_role,
            is_manager=is_manager,
            can_approve_team_leave=can_approve_team_leave,
            pending_approvals_count=pending_approvals_count,
            must_change_password=must_change_password,
            pending_policy_count=pending_policy_count,
            is_ess_admin=is_ess_admin,
            admin_use_web_portal=is_ess_admin,
        )

    def get_me_photo_download(self, ctx: TenantContext):
        """Stream the signed-in employee's HRMS profile photo."""
        from modules.hr.models.employee_profile import HrEmployeeProfile

        emp = self.resolve_employee(ctx)
        profile = self._db.scalar(
            select(HrEmployeeProfile).where(
                HrEmployeeProfile.employee_id == emp.id,
                HrEmployeeProfile.tenant_id == ctx.tenant_id,
                HrEmployeeProfile.is_deleted.is_(False),
            )
        )
        uri = getattr(profile, "profile_photo_uri", None) if profile else None
        if not uri:
            raise NotFoundException("Profile photo not found")
        return load_document_download(str(uri), "profile-photo")

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
        from modules.ess.dependencies import pin_ess_employee_context

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        rows = self._leave_types.list(ctx, emp.company_id)
        return [
            EssLeaveTypeResponse.model_validate(row)
            for row in rows
            if getattr(row, "status", "active") != "archived"
        ]

    def list_leave_balances(self, ctx: TenantContext) -> list[EssLeaveBalanceResponse]:
        from modules.ess.dependencies import pin_ess_employee_context

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        rows = self._leave_balances.list(ctx, emp.company_id)
        return [
            EssLeaveBalanceResponse.model_validate(row)
            for row in rows
            if row.employee_id == emp.id
        ]

    def list_leave_requests(self, ctx: TenantContext) -> list[EssLeaveRequestResponse]:
        from modules.ess.dependencies import pin_ess_employee_context

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        rows = self._leave_requests.list(ctx, emp.company_id)
        return [_leave_request_response(row) for row in rows if row.employee_id == emp.id]

    def create_leave_request(
        self, ctx: TenantContext, body: EssLeaveRequestCreate
    ) -> EssLeaveRequestResponse:
        from modules.ess.dependencies import pin_ess_employee_context

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
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

    def get_leave_request(self, ctx: TenantContext, request_id: UUID) -> EssLeaveRequestResponse:
        from modules.ess.dependencies import pin_ess_employee_context

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        row = self._leave_requests.get(ctx, request_id)
        if row.employee_id != emp.id:
            raise NotFoundException("Leave request not found")
        return _leave_request_response(row)

    def cancel_leave_request(self, ctx: TenantContext, request_id: UUID) -> EssLeaveRequestResponse:
        from modules.ess.dependencies import pin_ess_employee_context

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        row = self._leave_requests.cancel(ctx, request_id, employee_id=emp.id)
        return _leave_request_response(row)

    def list_attendance(
        self,
        ctx: TenantContext,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[EssAttendanceResponse]:
        from modules.ess.dependencies import pin_ess_employee_context

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        # Shared HRMS attendance (web / mobile / biometric / machine / manual).
        rows = self._attendance.list(ctx, emp.company_id, employee_id=emp.id)
        result: list[EssAttendanceResponse] = []
        for row in rows:
            if from_date and row.attendance_date < from_date:
                continue
            if to_date and row.attendance_date > to_date:
                continue
            result.append(_attendance_response(row))
        result.sort(key=lambda r: r.attendance_date, reverse=True)
        return result

    def attendance_summary(self, ctx: TenantContext, *, month: str):
        from modules.ess.schemas import EssAttendanceSummaryResponse

        emp = self.resolve_employee(ctx)
        year_s, mon_s = month.split("-", 1)
        year, mon = int(year_s), int(mon_s)
        rows = self.list_attendance(ctx)
        present = late = wfh = 0
        ot_minutes = 0
        for row in rows:
            if row.attendance_date.year != year or row.attendance_date.month != mon:
                continue
            st = (row.attendance_status or "").lower()
            if st in {"present", "late", "on_duty", "half_day"} or row.check_in_at:
                present += 1
            if st == "late" or (row.late_minutes or 0) > 0:
                late += 1
            if st == "work_from_home":
                wfh += 1
            ot_minutes += int(row.overtime_minutes or 0)
        return EssAttendanceSummaryResponse(
            month=month,
            present_days=present,
            late_days=late,
            total_overtime_minutes=ot_minutes,
            work_from_home_days=wfh,
        )

    def get_punch_policy(self, ctx: TenantContext):
        from modules.ess.dependencies import pin_ess_employee_context
        from modules.ess.schemas import EssPunchPolicyResponse, EssWorkLocationItem

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        rule = None
        try:
            rule = self._att_rules.get_active(ctx, emp.company_id)
        except ForbiddenException:
            # ESS sessions can park on a different company than the employee row;
            # still return office geofences for the location chip.
            rule = None
        profile = None
        try:
            profile = self._profiles.get_orm_by_employee_id(ctx, emp.id)
        except (ForbiddenException, NotFoundException):
            # HR company scope can hide the profile when ctx.company_id differs.
            profile = None
        face_enrolled = bool(getattr(profile, "face_auth_fingerprint", None))
        face_enabled = bool(getattr(profile, "face_auth_enabled", False))
        selfie = bool(rule and getattr(rule, "ess_selfie_required", False))
        face_punch = bool(rule and getattr(rule, "ess_face_at_punch_required", False))
        offices = self._office_locations(ctx, emp)
        home_loc = self._home_work_location(ctx, emp, offices)
        home_office_name = self._home_office_name(ctx, emp, offices, home_loc)
        home_id = home_loc.id if home_loc is not None else None
        work_locations = [
            EssWorkLocationItem(
                id=loc.id,
                location_name=str(loc.location_name),
                city=getattr(loc, "city", None),
                latitude=float(loc.latitude) if loc.latitude is not None else None,
                longitude=float(loc.longitude) if loc.longitude is not None else None,
                geofence_radius_meters=(
                    int(loc.geofence_radius_meters)
                    if loc.geofence_radius_meters is not None
                    else None
                ),
                location_type=getattr(loc, "location_type", None),
                is_home=bool(home_id is not None and loc.id == home_id),
            )
            for loc in offices
        ]
        # If HRMS has office lat/lng + radius, treat geofence as required for ESS check-in
        # even when the attendance-rule flag was never set.
        has_office_fence = any(self._location_has_geofence(loc) for loc in offices)
        return EssPunchPolicyResponse(
            geofence_required=bool(rule and rule.geofence_required) or has_office_fence,
            selfie_required=selfie,
            face_at_punch_required=face_punch or face_enabled,
            face_enrolled=face_enrolled,
            work_locations=work_locations,
            home_office_name=home_office_name,
        )

    def _approved_wfh_today(self, ctx: TenantContext, emp, day: date) -> bool:
        from modules.hr.service.wfh_service import WfhRequestService

        rows = WfhRequestService(self._db).list(ctx, emp.company_id)
        return WfhRequestService.is_approved_wfh_day(rows, emp.id, day)

    def _validate_punch_image(self, ctx: TenantContext, body: EssPunchRequest | None, policy) -> str | None:
        """Returns selfie fingerprint hash when image provided / required."""
        from modules.ess.face_utils import fingerprints_match, image_fingerprint

        image = body.image_base64 if body else None
        need_selfie = policy.selfie_required
        need_face = policy.face_at_punch_required
        if (need_selfie or need_face) and not image:
            raise AppException("Camera capture required for punch")
        if not image:
            return None
        try:
            fp = image_fingerprint(image)
        except ValueError as exc:
            raise AppException(str(exc)) from exc
        if need_face and policy.face_enrolled:
            emp = self.resolve_employee(ctx)
            profile = self._profiles.get_orm_by_employee_id(ctx, emp.id)
            stored = getattr(profile, "face_auth_fingerprint", None)
            if stored and not fingerprints_match(stored, fp):
                raise ForbiddenException("Face does not match enrolled profile")
        return fp

    @staticmethod
    def _location_has_geofence(loc: OrgLocation) -> bool:
        return (
            loc.latitude is not None
            and loc.longitude is not None
            and loc.geofence_radius_meters is not None
            and int(loc.geofence_radius_meters) > 0
        )

    def _office_locations(self, ctx: TenantContext, emp: EmployeeEntity) -> list[OrgLocation]:
        """Active office locations for the employee (branch first, else company)."""
        stmt = select(OrgLocation).where(
            OrgLocation.tenant_id == ctx.tenant_id,
            OrgLocation.company_id == emp.company_id,
            OrgLocation.is_deleted.is_(False),
            OrgLocation.status == "active",
        )
        rows = list(self._db.scalars(stmt).all())
        branch_rows = [r for r in rows if r.branch_id == emp.branch_id]
        scoped = branch_rows if branch_rows else rows
        return sorted(
            scoped,
            key=lambda loc: (
                0 if self._location_has_geofence(loc) else 1,
                str(loc.location_name or ""),
            ),
        )

    def _employment_work_location_text(
        self, ctx: TenantContext, emp: EmployeeEntity
    ) -> str | None:
        from modules.hr.models import HrEmployment

        row = self._db.scalar(
            select(HrEmployment)
            .where(
                HrEmployment.tenant_id == ctx.tenant_id,
                HrEmployment.employee_id == emp.id,
                HrEmployment.is_deleted.is_(False),
            )
            .order_by(HrEmployment.updated_at.desc())
            .limit(1)
        )
        text = (getattr(row, "work_location_text", None) or "").strip()
        return text or None

    def _branch_office_label(self, emp: EmployeeEntity) -> str | None:
        """Branch name from HRMS (e.g. Head Office) — preferred chip label at work."""
        from modules.organization.models.branch import OrgBranch

        if not emp.branch_id:
            return None
        branch = self._db.get(OrgBranch, emp.branch_id)
        if branch is None or getattr(branch, "is_deleted", False):
            return None
        name = str(getattr(branch, "branch_name", None) or "").strip()
        return name or None

    def _home_work_location(
        self,
        ctx: TenantContext,
        emp: EmployeeEntity,
        offices: list[OrgLocation],
    ) -> OrgLocation | None:
        """OrgLocation used as the employee's base / home office geofence."""
        if not offices:
            return None
        geofenced = [loc for loc in offices if self._location_has_geofence(loc)]
        work_text = self._employment_work_location_text(ctx, emp)
        if work_text:
            key = work_text.casefold()
            search_in = geofenced or offices
            for loc in search_in:
                name = str(loc.location_name or "")
                city = str(getattr(loc, "city", None) or "")
                if key in name.casefold() or name.casefold() in key:
                    return loc
                if city and (city.casefold() in key or key in city.casefold()):
                    return loc
        if geofenced:
            return geofenced[0]
        return offices[0]

    def _home_office_name(
        self,
        ctx: TenantContext,
        emp: EmployeeEntity,
        offices: list[OrgLocation],
        home_loc: OrgLocation | None = None,
    ) -> str | None:
        """Prefer branch name (Head Office), then base work location / employment text."""
        branch = self._branch_office_label(emp)
        if branch:
            return branch
        loc = home_loc if home_loc is not None else self._home_work_location(ctx, emp, offices)
        if loc is not None:
            return str(loc.location_name)
        work_text = self._employment_work_location_text(ctx, emp)
        return work_text

    def _geofence_locations(self, ctx: TenantContext, emp: EmployeeEntity) -> list[OrgLocation]:
        rows = self._office_locations(ctx, emp)
        return [
            r
            for r in rows
            if r.geofence_radius_meters is not None
            and r.latitude is not None
            and r.longitude is not None
        ]

    def _validate_geofence(
        self,
        ctx: TenantContext,
        emp: EmployeeEntity,
        latitude: float | None,
        longitude: float | None,
    ) -> None:
        rule = None
        try:
            rule = self._att_rules.get_active(ctx, emp.company_id)
        except Exception:
            rule = None
        geofence_required = bool(rule and rule.geofence_required)
        locations = self._geofence_locations(ctx, emp)
        # Office fences in HRMS always enforce check-in distance.
        if not locations and not geofence_required:
            return
        if latitude is None or longitude is None:
            raise AppException(
                "GPS is required for check-in. Enable location and try again at the office."
            )
        if not locations:
            # Policy requires GPS but no fence configured - accept any coords.
            return
        nearest_m: float | None = None
        nearest_name = "office"
        nearest_radius = 0.0
        for loc in locations:
            dist = _haversine_meters(
                float(latitude),
                float(longitude),
                float(loc.latitude),
                float(loc.longitude),
            )
            radius = float(loc.geofence_radius_meters or 0)
            if nearest_m is None or dist < nearest_m:
                nearest_m = dist
                nearest_name = str(loc.location_name or "office")
                nearest_radius = radius
            if dist <= radius:
                return
        branch = self._branch_office_label(emp) or nearest_name
        raise ConflictException(
            f"You are outside {branch} geofence "
            f"(~{int(nearest_m or 0)}m away; allowed {int(nearest_radius)}m). "
            "Move closer to the office and try again."
        )

    def _resolve_shift(self, ctx: TenantContext, emp: EmployeeEntity, day: date):
        """Prefer published roster for the day; else active/approved shift assignment."""
        return EssHrAdapter(self._db).resolve_shift(ctx, employee_id=emp.id, day=day)

    @staticmethod
    def _shift_window(
        shift, day: date, tz: ZoneInfo
    ) -> tuple[datetime, datetime]:
        start = datetime.combine(day, shift.start_time, tzinfo=tz)
        end = datetime.combine(day, shift.end_time, tzinfo=tz)
        if shift.is_overnight or end <= start:
            end = end + timedelta(days=1)
        return start, end

    def _check_in_status_fields(
        self, shift, local_now: datetime, *, ctx: TenantContext | None = None, company_id: UUID | None = None
    ) -> dict:
        if shift is None:
            return {"attendance_status": "present", "shift_id": None, "late_minutes": None}
        start, _ = self._shift_window(shift, local_now.date(), local_now.tzinfo)  # type: ignore[arg-type]
        grace = int(shift.grace_minutes or 0)
        if ctx is not None and company_id is not None:
            status, late_minutes = self._att_rules.resolve_checkin_status(
                ctx,
                company_id,
                check_in_at=local_now,
                shift_start=shift.start_time,
                shift_grace_minutes=grace,
                shift_id=str(shift.id),
                shift_code=str(shift.shift_code or ""),
            )
            return {
                "attendance_status": status,
                "shift_id": shift.id,
                "late_minutes": late_minutes,
            }
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
        shift,
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
        from modules.ess.dependencies import pin_ess_employee_context

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        local_now = _business_now()
        today = local_now.date()
        policy = self.get_punch_policy(ctx)
        selfie_hash = self._validate_punch_image(ctx, body, policy)

        wfh_day = self._approved_wfh_today(ctx, emp, today)
        latitude = body.latitude if body else None
        longitude = body.longitude if body else None

        now_utc = local_now.astimezone(timezone.utc)
        geo_fields: dict = {}
        if latitude is not None and longitude is not None:
            geo_fields["latitude"] = Decimal(str(latitude))
            geo_fields["longitude"] = Decimal(str(longitude))

        punch_source = "web" if wfh_day else "mobile"

        shift = self._resolve_shift(ctx, emp, today)
        check_in_fields = self._check_in_status_fields(
            shift, local_now, ctx=ctx, company_id=emp.company_id
        )
        if wfh_day:
            check_in_fields["attendance_status"] = "work_from_home"

        # Same HRMS attendance row as biometric/machine punches.
        rows = self._attendance.list(ctx, emp.company_id, employee_id=emp.id)
        rows = [row for row in rows if row.attendance_date == today]
        current = rows[0] if rows else None
        already_in = bool(current and getattr(current, "check_in_at", None))
        # Geofence only for check-in; allow check-out after machine punch from anywhere.
        if not already_in and not wfh_day:
            self._validate_geofence(ctx, emp, latitude, longitude)

        if current is None:
            created = self._attendance.create(
                ctx,
                branch_id=emp.branch_id,
                employee_id=emp.id,
                company_id=emp.company_id,
                attendance_date=today,
                check_in_at=now_utc,
                total_hours=None,
                source=punch_source,
                check_in_selfie_hash=selfie_hash,
                **check_in_fields,
                **geo_fields,
            )
            return EssPunchResponse(
                action="check_in", attendance=_attendance_response(created)
            )

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
                source=punch_source,
                check_in_selfie_hash=selfie_hash,
                **check_in_fields,
                **geo_fields,
            )
            return EssPunchResponse(
                action="check_in", attendance=_attendance_response(updated_in)
            )

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
            check_out_selfie_hash=selfie_hash,
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

    def list_wfh(self, ctx: TenantContext):
        from modules.ess.dependencies import pin_ess_employee_context
        from modules.hr.service.wfh_service import WfhRequestService

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        rows = WfhRequestService(self._db).list(ctx, emp.company_id)
        return [r for r in rows if r.employee_id == emp.id]

    def create_wfh(
        self,
        ctx: TenantContext,
        *,
        wfh_date: date,
        end_date: date | None = None,
        portion: str = "full_day",
        reason: str | None = None,
    ):
        from modules.ess.dependencies import pin_ess_employee_context
        from modules.hr.service.wfh_service import WfhRequestService

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        svc = WfhRequestService(self._db)
        row = svc.create(
            ctx,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            employee_id=emp.id,
            wfh_date=wfh_date,
            end_date=end_date,
            portion=portion,
            reason=reason,
            status="draft",
        )
        return svc.submit(ctx, row.id)

    def manager_approve_team_wfh(self, ctx: TenantContext, row_id: UUID):
        from modules.hr.service.wfh_service import WfhRequestService

        emp = self.resolve_employee(ctx)
        row = WfhRequestService(self._db).get(ctx, row_id)
        self._ensure_direct_report(ctx, row.employee_id)
        return WfhRequestService(self._db).manager_approve(
            ctx, row_id, approver_employee_id=emp.id
        )

    def reject_team_wfh(self, ctx: TenantContext, row_id: UUID):
        from modules.hr.service.wfh_service import WfhRequestService

        emp = self.resolve_employee(ctx)
        row = WfhRequestService(self._db).get(ctx, row_id)
        self._ensure_direct_report(ctx, row.employee_id)
        return WfhRequestService(self._db).reject(ctx, row_id, approver_employee_id=emp.id)

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
        # ESS regularization: allow at least 14 days even if HR rule is tighter/unset.
        raw_window = getattr(rule, "miss_punch_window_hours", None) if rule else None
        try:
            window_h = int(raw_window) if raw_window is not None else 336
        except (TypeError, ValueError):
            window_h = 336
        window_h = max(window_h, 336)
        today = _business_now().date()
        if attendance_date < today:
            max_days = max(1, window_h // 24)
            if (today - attendance_date).days > max_days:
                raise AppException(
                    f"Miss-punch / correction window is {max_days} day(s); date is too old"
                )

        # Cap open requests (draft/submitted). Approved history does not block new ones.
        year_count = 0
        for corr in self._corrections.list(ctx, emp.company_id):
            if corr.employee_id != emp.id:
                continue
            if getattr(corr, "attendance_date", None) is None:
                continue
            if corr.attendance_date.year != attendance_date.year:
                continue
            if corr.status in {"draft", "submitted"}:
                year_count += 1
        if year_count >= 5:
            raise AppException(
                "You already have 5 open regularization requests this year. "
                "Wait for your manager to action them before submitting more."
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

    def cancel_correction(self, ctx: TenantContext, row_id: UUID):
        """Employee revokes a submitted regularization before manager action."""
        emp = self.resolve_employee(ctx)
        row = self._corrections.get(ctx, row_id)
        if row.employee_id != emp.id:
            raise ForbiddenException("Not your correction request")
        return self._corrections.cancel(ctx, row_id)

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

    _ESS_DOC_TYPES = frozenset(
        {"id_proof", "address_proof", "contract", "certificate", "other"}
    )

    def get_document(self, ctx: TenantContext, document_id: UUID) -> EssDocumentResponse:
        emp = self.resolve_employee(ctx)
        row = self._documents.get(ctx, document_id)
        if row.employee_id != emp.id:
            raise ForbiddenException("Document does not belong to this employee")
        if getattr(row, "status", "active") == "archived":
            raise NotFoundException("Document not found")
        return EssDocumentResponse.model_validate(row)

    def upload_document(
        self, ctx: TenantContext, body: EssDocumentUploadBody
    ) -> EssDocumentResponse:
        emp = self.resolve_employee(ctx)
        doc_type = body.document_type.strip().lower()
        if doc_type not in self._ESS_DOC_TYPES:
            raise AppException(
                "document_type must be one of: id_proof, address_proof, contract, certificate, other"
            )
        payload = body.content_base64.strip()
        if payload.startswith("data:") and "," in payload:
            payload = payload.split(",", 1)[1]
        try:
            raw = base64.b64decode(payload, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise AppException("Invalid file content (base64)") from exc
        if not raw:
            raise AppException("Empty file")

        try:
            document_name = assert_safe_plain_text(
                body.document_name, field="document_name"
            )
            safe_name, _media = validate_upload(
                file_name=body.file_name,
                content_type=body.content_type,
                raw=raw,
                max_bytes=2 * 1024 * 1024,
                allowed_extensions=frozenset({".pdf", ".png", ".jpg", ".jpeg"}),
            )
        except (UnsafeUploadError, ValueError) as exc:
            raise AppException(str(exc)) from exc

        storage_uri = save_employee_document_bytes(
            company_id=emp.company_id,
            employee_id=emp.id,
            file_name=safe_name,
            raw=raw,
        )
        row = self._documents.create(
            ctx,
            branch_id=emp.branch_id,
            employee_id=emp.id,
            company_id=emp.company_id,
            document_type=doc_type,
            document_name=document_name,
            storage_uri=storage_uri,
            issued_on=body.issued_on,
            expires_on=body.expires_on,
            verification_status="pending",
            status="active",
        )
        return EssDocumentResponse.model_validate(row)

    def resolve_document_download(
        self, ctx: TenantContext, document_id: UUID
    ) -> DocumentDownload:
        """Return a filesystem path or S3 bytes payload for download."""
        doc = self.get_document(ctx, document_id)
        return load_document_download(doc.storage_uri, doc.document_name)

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

    @staticmethod
    def _drain_pending_notify_outbox(db, *, limit: int = 25) -> None:
        """Best-effort: deliver stuck outbox notifies when Celery is not running."""
        try:
            from modules.platform.outbox.dispatcher import OutboxDispatcher

            OutboxDispatcher(db).process_batch(limit=limit)
        except Exception:
            pass

    def list_notifications(self, ctx: TenantContext) -> list[EssNotificationResponse]:
        self._drain_pending_notify_outbox(self._db)
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
            out.append(self._notification_from_event(row))
        return out

    def _payroll_component_labels(
        self, company_id: UUID
    ) -> tuple[dict[str, str], dict[str, str]]:
        """HRMS salary-component + deduction-type names for payslip line labels."""
        from modules.payroll.models import PayDeductionType, PaySalaryComponent

        earning_labels = {
            str(row.component_code).upper(): str(row.component_name)
            for row in self._db.scalars(
                select(PaySalaryComponent).where(
                    PaySalaryComponent.company_id == company_id,
                    PaySalaryComponent.is_deleted.is_(False),
                )
            ).all()
            if row.component_code and row.component_name
        }
        deduction_labels = {
            str(row.deduction_type_code).upper(): str(row.deduction_type_name)
            for row in self._db.scalars(
                select(PayDeductionType).where(
                    PayDeductionType.company_id == company_id,
                    PayDeductionType.is_deleted.is_(False),
                )
            ).all()
            if row.deduction_type_code and row.deduction_type_name
        }
        # Mirror component codes that are deductions (EE_PF, PT, ITAX, …).
        for code, name in list(earning_labels.items()):
            if code in {"EE_PF", "PF", "PT", "ESI", "ITAX", "EMPR_PF"}:
                deduction_labels.setdefault(code, name)
        return earning_labels, deduction_labels

    def _run_line_breakdown(self, row) -> dict | None:
        pj = row.payslip_json if isinstance(getattr(row, "payslip_json", None), dict) else {}
        bd = pj.get("component_breakdown")
        if isinstance(bd, dict) and bd:
            return bd
        line_id = getattr(row, "payroll_run_line_id", None)
        if line_id is None:
            return None
        from modules.payroll.models import PayPayrollRunLine

        line = self._db.get(PayPayrollRunLine, line_id)
        if line is None:
            return None
        raw = getattr(line, "component_breakdown_json", None)
        return raw if isinstance(raw, dict) and raw else None

    def _enrich_payslip_lines(self, row) -> dict:
        """Resolve earnings/deductions from payslip JSON or HRMS payroll run line."""
        meta = _payslip_ess_fields(getattr(row, "payslip_json", None))
        earnings = meta.get("earnings")
        deductions = meta.get("deductions")
        if earnings and deductions:
            return meta

        bd = meta.get("component_breakdown") or self._run_line_breakdown(row) or {}
        if not bd:
            # Last resort: surface totals so the salary UI is never empty.
            if not deductions and _money_amount(getattr(row, "total_deductions", 0)) > 0:
                meta["deductions"] = [
                    {
                        "code": "total",
                        "label": "Total Deductions",
                        "amount": _money_amount(row.total_deductions),
                    }
                ]
            if not earnings and _money_amount(getattr(row, "gross_salary", 0)) > 0:
                meta["earnings"] = [
                    {
                        "code": "gross",
                        "label": "Gross Earnings",
                        "amount": _money_amount(row.gross_salary),
                    }
                ]
            return meta

        earning_labels, deduction_labels = self._payroll_component_labels(row.company_id)
        built_earn, built_ded = _lines_from_component_breakdown(
            bd,
            earning_labels=earning_labels,
            deduction_labels=deduction_labels,
        )
        if not earnings and built_earn:
            meta["earnings"] = built_earn
        if not deductions and built_ded:
            meta["deductions"] = built_ded
        elif not deductions and _money_amount(getattr(row, "total_deductions", 0)) > 0:
            meta["deductions"] = [
                {
                    "code": "total",
                    "label": "Total Deductions",
                    "amount": _money_amount(row.total_deductions),
                }
            ]
        return meta

    def list_payslips(self, ctx: TenantContext) -> list[EssPayslipSummary]:
        from modules.ess.dependencies import pin_ess_employee_context

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        rows = self._payslips.list(ctx, emp.company_id)
        out: list[EssPayslipSummary] = []
        for row in rows:
            if row.employee_id != emp.id:
                continue
            if row.status != "issued":
                continue
            meta = self._enrich_payslip_lines(row)
            out.append(
                EssPayslipSummary(
                    id=row.id,
                    document_number=row.document_number,
                    employee_code=row.employee_code,
                    employee_name=row.employee_name,
                    payroll_period_id=row.payroll_period_id,
                    period_name=meta.get("period_name"),
                    period_start=meta.get("period_start"),
                    period_end=meta.get("period_end"),
                    gross_salary=row.gross_salary,
                    total_deductions=row.total_deductions,
                    net_salary=row.net_salary,
                    issued_at=row.issued_at,
                    delivery_status=row.delivery_status,
                    payment_status=row.payment_status,
                    status=row.status,
                )
            )
        return out

    def get_payslip(self, ctx: TenantContext, payslip_id: UUID) -> EssPayslipDetail:
        from modules.ess.dependencies import pin_ess_employee_context

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        row = self._payslips.get(ctx, payslip_id)
        if row.employee_id != emp.id:
            raise ForbiddenException("Payslip does not belong to this employee")
        if row.status != "issued":
            raise ForbiddenException("Payslip is not available until issued")
        meta = self._enrich_payslip_lines(row)
        return EssPayslipDetail(
            id=row.id,
            document_number=row.document_number,
            employee_code=row.employee_code,
            employee_name=row.employee_name,
            payroll_period_id=row.payroll_period_id,
            period_name=meta.get("period_name"),
            period_start=meta.get("period_start"),
            period_end=meta.get("period_end"),
            gross_salary=row.gross_salary,
            total_deductions=row.total_deductions,
            net_salary=row.net_salary,
            issued_at=row.issued_at,
            delivery_status=row.delivery_status,
            payment_status=row.payment_status,
            status=row.status,
            payslip_json=row.payslip_json,
            export_text=meta.get("export_text"),
            attendance_summary=meta.get("attendance_summary"),
            earnings=meta.get("earnings"),
            deductions=meta.get("deductions"),
            company_id=row.company_id,
            branch_id=row.branch_id,
        )

    def get_payslip_export_text(self, ctx: TenantContext, payslip_id: UUID) -> str:
        detail = self.get_payslip(ctx, payslip_id)
        if detail.export_text:
            return detail.export_text
        return self._payslips.export_text(ctx, payslip_id)

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

    def list_team_members(self, ctx: TenantContext) -> list[EssTeamMember]:
        """Managers: list people who report to the signed-in employee."""
        from modules.organization.models.hierarchy import OrgDepartment

        emp = self.resolve_employee(ctx)
        reports = list(
            EssHrAdapter(self._db).list_direct_reports(manager_employee_id=emp.id)
        )
        if not reports:
            return []
        dept_ids = {r.department_id for r in reports if getattr(r, "department_id", None)}
        dept_names: dict = {}
        if dept_ids:
            for dept in self._db.scalars(
                select(OrgDepartment).where(
                    OrgDepartment.id.in_(dept_ids),
                    OrgDepartment.is_deleted.is_(False),
                )
            ).all():
                dept_names[dept.id] = getattr(dept, "department_name", None)
        out: list[EssTeamMember] = []
        for member in sorted(
            reports,
            key=lambda r: f"{getattr(r, 'first_name', '')} {getattr(r, 'last_name', '')}".strip().lower(),
        ):
            out.append(
                EssTeamMember(
                    employee_id=member.id,
                    employee_code=member.employee_code,
                    display_name=f"{member.first_name} {member.last_name}".strip(),
                    designation=member.designation or "",
                    email=member.email or "",
                    mobile=member.mobile or "",
                    department_name=dept_names.get(member.department_id),
                    status=member.status or "active",
                )
            )
        return out

    def list_team_leave(self, ctx: TenantContext) -> list[EssTeamLeaveItem]:
        emp = self.resolve_employee(ctx)
        reports = list(
            EssHrAdapter(self._db).list_direct_reports(manager_employee_id=emp.id)
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
        emp = self.resolve_employee(ctx)
        row = self._leave_requests.get(ctx, row_id)
        reports = {
            r.id
            for r in EssHrAdapter(self._db).list_direct_reports(manager_employee_id=emp.id)
        }
        if row.employee_id not in reports:
            raise ForbiddenException("Not a direct report leave request")
        return self._leave_requests.manager_approve(ctx, row_id, approver_employee_id=emp.id)

    def reject_team_leave(self, ctx: TenantContext, row_id: UUID):
        emp = self.resolve_employee(ctx)
        row = self._leave_requests.get(ctx, row_id)
        reports = {
            r.id
            for r in EssHrAdapter(self._db).list_direct_reports(manager_employee_id=emp.id)
        }
        if row.employee_id not in reports:
            raise ForbiddenException("Not a direct report leave request")
        return self._leave_requests.reject(ctx, row_id, approver_employee_id=emp.id)

    def _direct_reports(
        self, ctx: TenantContext, manager_employee_id: UUID
    ) -> tuple[set[UUID], dict]:
        reports = list(
            EssHrAdapter(self._db).list_direct_reports(manager_employee_id=manager_employee_id)
        )
        ids = {r.id for r in reports}
        by_id = {r.id: r for r in reports}
        return ids, by_id

    def _ensure_direct_report(self, ctx: TenantContext, employee_id: UUID) -> None:
        emp = self.resolve_employee(ctx)
        report_ids, _ = self._direct_reports(ctx, emp.id)
        if employee_id not in report_ids:
            raise ForbiddenException("Not a direct report")

    def list_pending_approvals(self, ctx: TenantContext) -> list:
        from modules.ess.schemas import EssApprovalItem
        from modules.hr.service.compoff_bio_service import CompoffRequestService
        from modules.hr.service.on_duty_ot_service import OnDutyRequestService

        emp = self.resolve_employee(ctx)
        report_ids, by_id = self._direct_reports(ctx, emp.id)
        if not report_ids:
            return []

        items: list[EssApprovalItem] = []

        def _name(member) -> str:
            return f"{member.first_name} {member.last_name}".strip()

        for row in self._leave_requests.list(ctx, emp.company_id):
            if row.employee_id not in report_ids or row.status != "submitted":
                continue
            member = by_id[row.employee_id]
            created = getattr(row, "created_at", None) or datetime.now(timezone.utc)
            items.append(
                EssApprovalItem(
                    category="leave",
                    id=row.id,
                    employee_id=row.employee_id,
                    employee_code=member.employee_code,
                    display_name=_name(member),
                    title=f"Leave {row.document_number}",
                    detail=f"{row.start_date} → {row.end_date} · {row.days_count} day(s)",
                    status=row.status,
                    occurred_at=created,
                )
            )

        compoff_svc = CompoffRequestService(self._db)
        for row in compoff_svc.list(ctx, emp.company_id):
            if row.employee_id not in report_ids or row.status != "submitted":
                continue
            member = by_id[row.employee_id]
            created = getattr(row, "created_at", None) or datetime.now(timezone.utc)
            items.append(
                EssApprovalItem(
                    category="compoff",
                    id=row.id,
                    employee_id=row.employee_id,
                    employee_code=member.employee_code,
                    display_name=_name(member),
                    title="Comp Off request",
                    detail=(
                        f"{row.earned_date} · {row.extra_hours}h → {row.requested_days} day(s)"
                    ),
                    status=row.status,
                    occurred_at=created,
                )
            )

        on_duty_svc = OnDutyRequestService(self._db)
        for row in on_duty_svc.list(ctx, emp.company_id):
            if row.employee_id not in report_ids or row.status != "submitted":
                continue
            member = by_id[row.employee_id]
            created = getattr(row, "created_at", None) or datetime.now(timezone.utc)
            items.append(
                EssApprovalItem(
                    category="on_duty",
                    id=row.id,
                    employee_id=row.employee_id,
                    employee_code=member.employee_code,
                    display_name=_name(member),
                    title="On duty request",
                    detail=f"{row.duty_date} · {row.portion}",
                    status=row.status,
                    occurred_at=created,
                )
            )

        from modules.hr.service.wfh_service import WfhRequestService

        wfh_svc = WfhRequestService(self._db)
        for row in wfh_svc.list(ctx, emp.company_id):
            if row.employee_id not in report_ids or row.status != "submitted":
                continue
            member = by_id[row.employee_id]
            created = getattr(row, "created_at", None) or datetime.now(timezone.utc)
            items.append(
                EssApprovalItem(
                    category="wfh",
                    id=row.id,
                    employee_id=row.employee_id,
                    employee_code=member.employee_code,
                    display_name=_name(member),
                    title="Work from home",
                    detail=f"{row.wfh_date} · {row.portion}",
                    status=row.status,
                    occurred_at=created,
                )
            )

        # Load by direct-report ids (not manager company/branch HR filter) so
        # regularization always appears in the manager ESS inbox.
        from modules.hr.models.attendance_correction import HrAttendanceCorrection

        corr_rows = list(
            self._db.scalars(
                select(HrAttendanceCorrection).where(
                    HrAttendanceCorrection.tenant_id == ctx.tenant_id,
                    HrAttendanceCorrection.is_deleted.is_(False),
                    HrAttendanceCorrection.employee_id.in_(report_ids),
                    HrAttendanceCorrection.status == "submitted",
                )
            ).all()
        )
        for row in corr_rows:
            member = by_id.get(row.employee_id)
            if member is None:
                continue
            created = getattr(row, "created_at", None) or datetime.now(timezone.utc)
            field = str(row.field_name or "").replace("_", " ")
            items.append(
                EssApprovalItem(
                    category="attendance_correction",
                    id=row.id,
                    employee_id=row.employee_id,
                    employee_code=member.employee_code,
                    display_name=_name(member),
                    title="Attendance regularization",
                    detail=f"{row.attendance_date} · {field} → {row.new_value}",
                    status=row.status,
                    occurred_at=created,
                )
            )

        items.sort(key=lambda x: -x.occurred_at.timestamp())
        return items

    def count_pending_approvals(self, ctx: TenantContext) -> int:
        return len(self.list_pending_approvals(ctx))

    def manager_approve_team_compoff(self, ctx: TenantContext, row_id: UUID):
        from modules.hr.service.compoff_bio_service import CompoffRequestService

        emp = self.resolve_employee(ctx)
        svc = CompoffRequestService(self._db)
        row = svc.get(ctx, row_id)
        self._ensure_direct_report(ctx, row.employee_id)
        return svc.manager_approve(ctx, row_id, approver_employee_id=emp.id)

    def reject_team_compoff(self, ctx: TenantContext, row_id: UUID):
        from modules.hr.service.compoff_bio_service import CompoffRequestService

        emp = self.resolve_employee(ctx)
        svc = CompoffRequestService(self._db)
        row = svc.get(ctx, row_id)
        self._ensure_direct_report(ctx, row.employee_id)
        return svc.reject(ctx, row_id, approver_employee_id=emp.id)

    def approve_team_on_duty(self, ctx: TenantContext, row_id: UUID):
        from modules.hr.service.on_duty_ot_service import OnDutyRequestService

        emp = self.resolve_employee(ctx)
        row = OnDutyRequestService(self._db).get(ctx, row_id)
        self._ensure_direct_report(ctx, row.employee_id)
        return OnDutyRequestService(self._db).manager_approve(
            ctx, row_id, approver_employee_id=emp.id
        )

    def reject_team_on_duty(self, ctx: TenantContext, row_id: UUID):
        from modules.hr.service.on_duty_ot_service import OnDutyRequestService

        emp = self.resolve_employee(ctx)
        row = OnDutyRequestService(self._db).get(ctx, row_id)
        self._ensure_direct_report(ctx, row.employee_id)
        return OnDutyRequestService(self._db).reject(
            ctx, row_id, approver_employee_id=emp.id
        )

    def approve_team_correction(self, ctx: TenantContext, row_id: UUID):
        emp = self.resolve_employee(ctx)
        row = self._corrections.get(ctx, row_id)
        self._ensure_direct_report(ctx, row.employee_id)
        return self._corrections.manager_approve(
            ctx, row_id, approver_employee_id=emp.id
        )

    def reject_team_correction(self, ctx: TenantContext, row_id: UUID):
        row = self._corrections.get(ctx, row_id)
        self._ensure_direct_report(ctx, row.employee_id)
        return self._corrections.reject(ctx, row_id)

    def notification_unread_count(self, ctx: TenantContext) -> int:
        from sqlalchemy import func

        self._drain_pending_notify_outbox(self._db, limit=15)
        emp = self.resolve_employee(ctx)
        if not emp.user_id:
            return 0
        count = self._db.scalar(
            select(func.count())
            .select_from(NtfEvent)
            .where(
                NtfEvent.tenant_id == ctx.tenant_id,
                NtfEvent.recipient_user_id == emp.user_id,
                NtfEvent.read_at.is_(None),
                NtfEvent.status != "read",
            )
        )
        return int(count or 0)

    def notification_poll(self, ctx: TenantContext) -> EssNotificationPollResponse:
        count = self.notification_unread_count(ctx)
        emp = self.resolve_employee(ctx)
        latest: EssNotificationResponse | None = None
        if emp.user_id and count > 0:
            row = self._db.scalar(
                select(NtfEvent)
                .where(
                    NtfEvent.tenant_id == ctx.tenant_id,
                    NtfEvent.recipient_user_id == emp.user_id,
                    NtfEvent.read_at.is_(None),
                    NtfEvent.status != "read",
                )
                .order_by(NtfEvent.created_at.desc())
                .limit(1)
            )
            if row is not None:
                latest = self._notification_from_event(row)
        return EssNotificationPollResponse(unread_count=count, latest=latest)

    def mark_notification_read(self, ctx: TenantContext, notification_id: UUID) -> None:
        emp = self.resolve_employee(ctx)
        row = self._db.get(NtfEvent, notification_id)
        if row is None or row.recipient_user_id != emp.user_id:
            raise NotFoundException("Notification not found")
        if row.read_at is None:
            row.read_at = utcnow()
        row.status = "read"

    def mark_all_notifications_read(self, ctx: TenantContext) -> int:
        emp = self.resolve_employee(ctx)
        if not emp.user_id:
            return 0
        rows = list(
            self._db.scalars(
                select(NtfEvent).where(
                    NtfEvent.tenant_id == ctx.tenant_id,
                    NtfEvent.recipient_user_id == emp.user_id,
                    NtfEvent.read_at.is_(None),
                    NtfEvent.status != "read",
                )
            ).all()
        )
        now = utcnow()
        for row in rows:
            if row.read_at is None:
                row.read_at = now
            row.status = "read"
        return len(rows)

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
        emp = self.resolve_employee(ctx)
        pairs = EssAssetAdapter(self._db).list_assigned_assets(employee_id=emp.id)
        return [
            EssAssetItem(
                id=asset.id,
                asset_code=asset.asset_code,
                asset_name=asset.asset_name,
                asset_type=asset.asset_type,
                serial_number=asset.serial_number,
                status=asset.status,
                assignment_status="active",
            )
            for asset, _asn in pairs
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
                notice_status=getattr(row, "notice_status", None),
                expected_exit_date=getattr(row, "expected_exit_date", None),
                notice_period_days=getattr(row, "notice_period_days", None),
            )
            for row in rows
            if row.employee_id == emp.id
        ]

    def list_profile_update_requests(self, ctx: TenantContext):
        from modules.ess.dependencies import pin_ess_employee_context
        from modules.ess.schemas import EssProfileUpdateResponse
        from modules.hr.service.profile_update_service import ProfileUpdateRequestService

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        rows = ProfileUpdateRequestService(self._db).list_for_employee(
            ctx, company_id=emp.company_id, employee_id=emp.id
        )
        rows = sorted(
            rows,
            key=lambda r: getattr(r, "created_at", None)
            or datetime(1970, 1, 1, tzinfo=timezone.utc),
            reverse=True,
        )
        return [
            EssProfileUpdateResponse(
                id=row.id,
                notes=row.notes,
                status=row.status,
                created_at=getattr(row, "created_at", None),
                decided_at=getattr(row, "decided_at", None),
                decision_notes=getattr(row, "decision_notes", None),
            )
            for row in rows
        ]

    def create_profile_update_request(self, ctx: TenantContext, *, notes: str | None = None):
        from modules.ess.dependencies import pin_ess_employee_context
        from modules.ess.schemas import EssProfileUpdateResponse
        from modules.hr.service.profile_update_service import ProfileUpdateRequestService

        emp = self.resolve_employee(ctx)
        ctx = pin_ess_employee_context(
            ctx, company_id=emp.company_id, branch_id=emp.branch_id
        )
        row = ProfileUpdateRequestService(self._db).create(
            ctx,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            employee_id=emp.id,
            notes=notes,
        )
        return EssProfileUpdateResponse(
            id=row.id,
            notes=row.notes,
            status=row.status,
            created_at=getattr(row, "created_at", None),
            decided_at=getattr(row, "decided_at", None),
            decision_notes=getattr(row, "decision_notes", None),
        )

    def create_separation(self, ctx: TenantContext, body: EssSeparationCreate) -> EssSeparationItem:
        from modules.hr.service.separation_service import SeparationService

        emp = self.resolve_employee(ctx)
        row = SeparationService(self._db).create(
            ctx,
            branch_id=emp.branch_id,
            employee_id=emp.id,
            company_id=emp.company_id,
            separation_type=body.separation_type or "resignation",
            requested_last_working_date=body.requested_last_working_date,
            reason=body.reason,
            resignation_date=body.resignation_date or date.today(),
            notice_period_days=body.notice_period_days,
            initiated_by="employee",
            serve_notice=True,
        )
        return EssSeparationItem(
            id=row.id,
            document_number=row.document_number,
            separation_type=row.separation_type,
            requested_last_working_date=row.requested_last_working_date,
            status=row.status,
            fnf_status=getattr(row, "fnf_status", None),
            notice_status=getattr(row, "notice_status", None),
            expected_exit_date=getattr(row, "expected_exit_date", None),
            notice_period_days=getattr(row, "notice_period_days", None),
        )

    def _profile_orm(self, ctx: TenantContext, emp: EmployeeEntity):
        profile = self._profiles.get_orm_by_employee_id(ctx, emp.id)
        if profile is None:
            raise NotFoundException("Employee profile not found")
        return profile

    def face_status(self, ctx: TenantContext):
        from modules.ess.schemas import EssFaceStatusResponse

        emp = self.resolve_employee(ctx)
        profile = self._profile_orm(ctx, emp)
        fp = getattr(profile, "face_auth_fingerprint", None)
        enabled = bool(getattr(profile, "face_auth_enabled", False))
        enrolled = bool(fp)
        return EssFaceStatusResponse(
            enrolled=enrolled,
            enabled=enabled,
            verification_required=enabled and enrolled,
        )

    def face_enroll(self, ctx: TenantContext, image_base64: str, *, enable: bool = True):
        from modules.ess.face_utils import image_fingerprint
        from modules.ess.schemas import EssFaceStatusResponse

        emp = self.resolve_employee(ctx)
        profile = self._profile_orm(ctx, emp)
        try:
            fp = image_fingerprint(image_base64)
        except ValueError as exc:
            raise AppException(str(exc)) from exc
        self._profiles.update(
            ctx,
            profile.id,
            face_auth_fingerprint=fp,
            face_auth_enabled=enable,
        )
        return EssFaceStatusResponse(
            enrolled=True,
            enabled=enable,
            verification_required=enable,
        )

    def face_verify(self, ctx: TenantContext, image_base64: str):
        from modules.ess.face_utils import fingerprints_match, image_fingerprint
        from modules.ess.schemas import EssFaceVerifyResponse

        emp = self.resolve_employee(ctx)
        profile = self._profile_orm(ctx, emp)
        stored = getattr(profile, "face_auth_fingerprint", None)
        if not stored or not getattr(profile, "face_auth_enabled", False):
            return EssFaceVerifyResponse(verified=True, message="Face verification not required")
        try:
            candidate = image_fingerprint(image_base64)
        except ValueError as exc:
            raise AppException(str(exc)) from exc
        if fingerprints_match(stored, candidate):
            return EssFaceVerifyResponse(verified=True, message="Face verified")
        raise ForbiddenException("Face does not match the enrolled profile")

    def face_set_enabled(self, ctx: TenantContext, enabled: bool):
        from modules.ess.schemas import EssFaceStatusResponse

        emp = self.resolve_employee(ctx)
        profile = self._profile_orm(ctx, emp)
        if enabled and not getattr(profile, "face_auth_fingerprint", None):
            raise AppException("Enroll your face before enabling verification")
        self._profiles.update(ctx, profile.id, face_auth_enabled=enabled)
        enrolled = bool(getattr(profile, "face_auth_fingerprint", None))
        return EssFaceStatusResponse(
            enrolled=enrolled,
            enabled=enabled,
            verification_required=enabled and enrolled,
        )

    def _workplace(self):
        from modules.ess.workplace_service import EssWorkplaceService

        return EssWorkplaceService(self._db, self)

    def list_meeting_rooms(self, ctx: TenantContext):
        return self._workplace().list_meeting_rooms(ctx)

    def meeting_room_availability(self, ctx: TenantContext, *, on_date: date):
        return self._workplace().meeting_room_availability(ctx, on_date=on_date)

    def list_meeting_bookings(self, ctx: TenantContext, *, on_date: date | None = None):
        return self._workplace().list_meeting_bookings(ctx, on_date=on_date)

    def create_meeting_booking(self, ctx: TenantContext, body):
        return self._workplace().create_meeting_booking(ctx, body)

    def get_asset(self, ctx: TenantContext, asset_id: UUID):
        return self._workplace().get_asset(ctx, asset_id)

    def lookup_asset(self, ctx: TenantContext, *, code: str):
        return self._workplace().lookup_asset(ctx, code=code)

    def create_asset_ticket(self, ctx: TenantContext, asset_id: UUID, **fields):
        return self._workplace().create_asset_ticket(ctx, asset_id, **fields)

    def list_support_tickets(self, ctx: TenantContext):
        return self._workplace().list_support_tickets(ctx)

    def get_support_ticket(self, ctx: TenantContext, ticket_id: UUID):
        return self._workplace().get_support_ticket(ctx, ticket_id)

    def create_support_ticket(self, ctx: TenantContext, body):
        return self._workplace().create_support_ticket(ctx, body)

    def list_support_ticket_comments(self, ctx: TenantContext, ticket_id: UUID):
        return self._workplace().list_support_ticket_comments(ctx, ticket_id)

    def add_support_ticket_comment(self, ctx: TenantContext, ticket_id: UUID, body):
        return self._workplace().add_support_ticket_comment(ctx, ticket_id, body)

    def _compliance(self):
        from modules.ess.compliance_service import EssComplianceService

        return EssComplianceService(self._db, self)

    def list_policies(self, ctx: TenantContext):
        return self._compliance().list_policies(ctx)

    def get_policy_walkthrough(self, ctx: TenantContext, policy_id: UUID):
        return self._compliance().get_policy_walkthrough(ctx, policy_id)

    def acknowledge_policy(self, ctx: TenantContext, policy_id: UUID):
        return self._compliance().acknowledge_policy(ctx, policy_id)

    def change_password(self, ctx: TenantContext, body):
        return self._compliance().change_password(ctx, body)
