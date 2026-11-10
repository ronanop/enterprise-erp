"""Comp Off Emp→Mgr→HR allocation + biometric device sync services."""

from __future__ import annotations

import hmac
import re
import secrets
import socket
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

try:
    from zk import ZK
    from zk.exception import ZKErrorResponse, ZKNetworkError
except ModuleNotFoundError:  # optional runtime dep (pyzk) - not always in the API image
    ZK = None  # type: ignore[misc, assignment]

    class ZKErrorResponse(Exception):
        """Fallback when pyzk is not installed."""

    class ZKNetworkError(Exception):
        """Fallback when pyzk is not installed."""

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.base import hash_token
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import AttendanceSource
from modules.hr.domain.exceptions import InvalidLeaveRequestState
from modules.hr.schemas import (
    BiometricDeviceFeedResponse,
    BiometricDeviceLiveLogItem,
    BiometricDeviceResponse,
    BiometricPunchResponse,
)
from modules.hr.repository.attendance_repository import AttendanceRepository
from modules.hr.repository.compoff_bio_repository import (
    BiometricDeviceRepository,
    BiometricPunchRepository,
    CompoffRequestRepository,
)
from modules.hr.repository.employment_repository import EmploymentRepository
from modules.hr.repository.management_group_repository import ManagementGroupRepository
from modules.hr.repository.shift_assignment_repository import ShiftAssignmentRepository
from modules.hr.repository.shift_repository import ShiftRepository
from modules.hr.service.attendance_service import AttendanceService
from modules.hr.service.attendance_policy_apply import AttendancePolicyApplyService
from modules.hr.service.attendance_policy_service import AttendanceRuleService
from modules.hr.service.hr_scope_validator import HrScopeValidator
from modules.hr.service.leave_service import LeaveBalanceService


class CompoffRequestService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = CompoffRequestRepository(db)
        self._balances = LeaveBalanceService(db)
        self._rules = AttendanceRuleService(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Comp Off request not found")
        return row

    def suggest_days(self, ctx: TenantContext, company_id: UUID, hours: Decimal) -> Decimal:
        rule = self._rules.get_active(ctx, company_id)
        half = Decimal(str(getattr(rule, "compoff_half_day_hours", 4) or 4)) if rule else Decimal("4")
        full = Decimal(str(getattr(rule, "compoff_full_day_hours", 8) or 8)) if rule else Decimal("8")
        if hours >= full:
            return Decimal("1")
        if hours >= half:
            return Decimal("0.5")
        return Decimal("0")

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        earned_date: date,
        extra_hours: Decimal | float,
        company_id: UUID | None = None,
        requested_days: Decimal | float | None = None,
        reason: str | None = None,
        status: str = "draft",
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        hours = Decimal(str(extra_hours))
        if hours <= 0:
            raise AppException("extra_hours must be positive")
        days = Decimal(str(requested_days)) if requested_days is not None else self.suggest_days(ctx, cid, hours)
        if days <= 0:
            raise AppException("Hours below Comp Off half-day threshold")
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            earned_date=earned_date,
            extra_hours=hours,
            requested_days=days,
            reason=reason,
            status=status,
        )

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status != "draft":
            raise InvalidLeaveRequestState("Only draft Comp Off requests can be submitted")
        updated = self._repo.update(ctx, row_id, status="submitted")
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.compoff_submitted",
                template_name="Comp Off Submitted",
                event_type="hr.compoff_submitted",
                title="Comp Off request submitted",
                body=f"Comp Off for {row.earned_date} ({row.requested_days} day(s)) pending manager approval.",
                kind="compoff",
            )
        except Exception:
            pass
        return updated

    def manager_approve(self, ctx: TenantContext, row_id: UUID, *, approver_employee_id: UUID | None = None):
        row = self.get(ctx, row_id)
        if row.status != "submitted":
            raise InvalidLeaveRequestState("Only submitted Comp Off requests can be manager-approved")
        return self._repo.update(
            ctx,
            row_id,
            status="manager_approved",
            manager_approver_id=approver_employee_id,
        )

    def approve(self, ctx: TenantContext, row_id: UUID, *, approver_employee_id: UUID | None = None):
        row = self.get(ctx, row_id)
        if row.status not in {"submitted", "manager_approved"}:
            raise InvalidLeaveRequestState("Comp Off must be submitted or manager-approved for HR allocation")
        self._balances.credit_compoff(
            ctx,
            branch_id=row.branch_id,
            employee_id=row.employee_id,
            days=row.requested_days,
            company_id=row.company_id,
            reason=f"compoff_request:{row.id}:{row.earned_date.isoformat()}",
            earned_date=row.earned_date,
        )
        updated = self._repo.update(
            ctx,
            row_id,
            status="approved",
            hr_approver_id=approver_employee_id,
            decided_at=datetime.now(timezone.utc),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_compoff_request",
            entity_id=row_id,
            operation="approve",
            performed_by=ctx.user_id,
        )
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.compoff_approved",
                template_name="Comp Off Allocated",
                event_type="hr.compoff_approved",
                title="Comp Off allocated",
                body=f"{row.requested_days} Comp Off day(s) credited for {row.earned_date}.",
                kind="compoff",
            )
        except Exception:
            pass
        return updated

    def reject(self, ctx: TenantContext, row_id: UUID, *, approver_employee_id: UUID | None = None):
        row = self.get(ctx, row_id)
        if row.status not in {"submitted", "manager_approved"}:
            raise InvalidLeaveRequestState("Only submitted/manager-approved Comp Off can be rejected")
        return self._repo.update(
            ctx,
            row_id,
            status="rejected",
            hr_approver_id=approver_employee_id,
            decided_at=datetime.now(timezone.utc),
        )


_DEVICE_LOCAL_TZ = timezone(timedelta(hours=5, minutes=30))
_LOG_LOOKBACK_DAYS = 31

_IPV4 = re.compile(
    r"^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$"
)


def _clean_ipv4(value: str | None, label: str) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if not _IPV4.match(text):
        raise AppException(f"{label} must be an IPv4 address")
    return text


def _clean_comm_password(value: str | None) -> str | None:
    """ZKTeco Comm. password: empty or 0 means no password. Otherwise 1–6 digits."""
    if value is None:
        return None
    text = str(value).strip()
    if not text or text == "0":
        return "0"
    if not text.isdigit() or len(text) > 6:
        raise AppException("Communication password must be 0, or 1 to 6 digits")
    return text


class BiometricDeviceService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = BiometricDeviceRepository(db)
        self._punches = BiometricPunchRepository(db)
        self._attendance = AttendanceRepository(db)
        self._attendance_svc = AttendanceService(db)
        self._policy = AttendancePolicyApplyService(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._employment = EmploymentRepository(db)
        self._mgmt = ManagementGroupRepository(db)
        self._shift_assignments = ShiftAssignmentRepository(db)
        self._shifts = ShiftRepository(db)
        self._audit = PlatformAuditFacade(db)

    @staticmethod
    def _probe_device(ip: str | None, port: int | None) -> tuple[bool, str]:
        if not ip or not port:
            return False, "Configure IP and port to connect to the device."
        try:
            with socket.create_connection((str(ip).strip(), int(port)), timeout=3):
                return True, f"Device reachable at {ip}:{port}"
        except OSError as exc:
            return False, f"Cannot reach {ip}:{port} - {exc}"

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Biometric device not found")
        return row

    def live_feed(self, ctx: TenantContext, row_id: UUID, *, days: int = 14) -> BiometricDeviceFeedResponse:
        device = self.get(ctx, row_id)
        reachable, reachability_message = self._probe_device(device.ip_address, device.port)
        cid = device.company_id
        today = date.today()
        cutoff = today - timedelta(days=max(1, min(days, 90)))

        punch_rows = self._punches.list_for_device(
            ctx,
            device_id=device.id,
            date_from=cutoff,
            date_to=today,
            limit=300,
        )
        punches: list[BiometricPunchResponse] = []
        today_punch_count = 0
        touched_emp_dates: set[tuple[UUID, date]] = set()
        for p in punch_rows:
            emp_name: str | None = None
            emp_code: str | None = p.employee_code_raw
            if p.employee_id:
                touched_emp_dates.add((p.employee_id, p.attendance_date))
                try:
                    emp = self._master.get_employee(ctx, p.employee_id)
                    emp_name = " ".join(
                        x
                        for x in (getattr(emp, "first_name", None), getattr(emp, "last_name", None))
                        if x
                    ).strip() or None
                    emp_code = str(getattr(emp, "employee_code", None) or p.employee_code_raw) or None
                except Exception:
                    pass
            if p.attendance_date == today:
                today_punch_count += 1
            punches.append(
                BiometricPunchResponse(
                    id=p.id,
                    device_id=p.device_id,
                    device_code=p.device_code,
                    employee_id=p.employee_id,
                    employee_code=emp_code,
                    employee_name=emp_name,
                    employee_code_raw=p.employee_code_raw,
                    punched_at=p.punched_at,
                    attendance_date=p.attendance_date,
                    notes=p.notes,
                )
            )

        ingested: list[BiometricDeviceLiveLogItem] = []
        for emp_id, att_date in touched_emp_dates:
            row = None
            for cand in self._attendance.list_rows(ctx, cid):
                if cand.employee_id == emp_id and cand.attendance_date == att_date:
                    row = cand
                    break
            if row is None:
                continue
            emp_name = None
            emp_code = None
            try:
                emp = self._master.get_employee(ctx, row.employee_id)
                emp_name = " ".join(
                    x
                    for x in (getattr(emp, "first_name", None), getattr(emp, "last_name", None))
                    if x
                ).strip() or None
                emp_code = str(getattr(emp, "employee_code", None) or "") or None
            except Exception:
                pass
            ingested.append(
                BiometricDeviceLiveLogItem(
                    id=row.id,
                    employee_id=row.employee_id,
                    employee_code=emp_code,
                    employee_name=emp_name,
                    attendance_date=row.attendance_date,
                    check_in_at=row.check_in_at,
                    check_out_at=row.check_out_at,
                    attendance_status=row.attendance_status,
                    notes=row.notes,
                    updated_at=getattr(row, "updated_at", None),
                )
            )
        ingested.sort(
            key=lambda r: (
                r.attendance_date,
                r.check_in_at or datetime.min.replace(tzinfo=timezone.utc),
            ),
            reverse=True,
        )

        return BiometricDeviceFeedResponse(
            device=BiometricDeviceResponse.model_validate(device),
            reachable=reachable,
            reachability_message=reachability_message,
            today_ingested_count=len([r for r in ingested if r.attendance_date == today]),
            today_punch_count=today_punch_count,
            punches=punches,
            ingested_records=ingested[:100],
        )

    def list_employee_punches(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID,
        company_id: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 500,
    ) -> list[BiometricPunchResponse]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._punches.list_for_employee(
            ctx,
            company_id=cid,
            employee_id=employee_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
        out: list[BiometricPunchResponse] = []
        emp_name: str | None = None
        emp_code: str | None = None
        try:
            emp = self._master.get_employee(ctx, employee_id)
            emp_name = " ".join(
                x for x in (getattr(emp, "first_name", None), getattr(emp, "last_name", None)) if x
            ).strip() or None
            emp_code = str(getattr(emp, "employee_code", None) or "") or None
        except Exception:
            pass
        for p in rows:
            out.append(
                BiometricPunchResponse(
                    id=p.id,
                    device_id=p.device_id,
                    device_code=p.device_code,
                    employee_id=p.employee_id,
                    employee_code=emp_code or p.employee_code_raw,
                    employee_name=emp_name,
                    employee_code_raw=p.employee_code_raw,
                    punched_at=p.punched_at,
                    attendance_date=p.attendance_date,
                    notes=p.notes,
                )
            )
        return out

    def resolve_shift_for_employee(
        self,
        ctx: TenantContext,
        company_id: UUID,
        employee_id: UUID,
        attendance_date: date,
    ) -> UUID | None:
        """Prefer active assignment → management-group default → general shift."""
        assignments = self._shift_assignments.list_for_employee(ctx, employee_id)
        active = []
        for a in assignments:
            if a.status not in {"active", "approved"}:
                continue
            if a.effective_from > attendance_date:
                continue
            if a.effective_to is not None and a.effective_to < attendance_date:
                continue
            active.append(a)
        if active:
            active.sort(key=lambda r: r.effective_from, reverse=True)
            return active[0].shift_id

        employment = self._employment.get_by_employee_id(ctx, employee_id)
        if employment and employment.management_group_id:
            group = self._mgmt.get(ctx, employment.management_group_id)
            if group and group.default_shift_id:
                return group.default_shift_id

        for shift in self._shifts.list_rows(ctx, company_id):
            if shift.status != "active":
                continue
            if str(shift.shift_type).lower() == "general":
                return shift.id
        for shift in self._shifts.list_rows(ctx, company_id):
            if shift.status == "active":
                return shift.id
        return None

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        device_code: str,
        device_name: str,
        company_id: UUID | None = None,
        device_model: str = "fingerprint_k40_timelabs",
        ip_address: str | None = None,
        port: int | None = None,
        subnet_mask: str | None = None,
        gateway: str | None = None,
        comm_password: str | None = None,
        location_text: str | None = None,
        status: str = "active",
        generate_api_key: bool = True,
    ):
        # Module-wide HR admins resolve company_id as None — create must use branch.company_id.
        self._scope.validate_branch_access(ctx, branch_id)
        cid = self._scope.resolve_create_company_id(
            ctx, branch_id=branch_id, company_id=company_id
        )
        if device_model not in {"fingerprint_k40_timelabs", "fingerprint_k40_zkteco_pro"}:
            raise AppException(f"Unsupported biometric device model: {device_model}")
        code = (device_code or "").strip()
        if not code:
            raise AppException("Device code is required")
        if ip_address is not None and not str(ip_address).strip():
            ip_address = None
        if port is not None and (port < 1 or port > 65535):
            raise AppException("Port must be between 1 and 65535")
        subnet_clean = _clean_ipv4(subnet_mask, "Subnet mask")
        gateway_clean = _clean_ipv4(gateway, "Gateway")
        comm_clean = _clean_comm_password(comm_password)

        existing = self._repo.get_by_code_including_deleted(ctx, cid, code)
        if existing is not None and not getattr(existing, "is_deleted", False):
            raise ConflictException(
                f"Device code '{code}' is already registered. Use a different code "
                f"(e.g. K40-02) or open the existing device."
            )

        plaintext: str | None = None
        api_key_hash = None
        if generate_api_key:
            plaintext = secrets.token_urlsafe(32)
            api_key_hash = hash_token(plaintext)

        ip_clean = ip_address.strip() if ip_address else None

        # Soft-deleted row still holds the unique (company_id, device_code) — revive it.
        if existing is not None and getattr(existing, "is_deleted", False):
            existing.is_deleted = False
            existing.deleted_at = None
            existing.deleted_by = None
            existing.branch_id = branch_id
            existing.device_name = device_name
            existing.device_model = device_model
            existing.ip_address = ip_clean
            existing.port = port
            existing.subnet_mask = subnet_clean
            existing.gateway = gateway_clean
            existing.comm_password = comm_clean
            existing.location_text = location_text
            existing.status = status
            if api_key_hash is not None:
                existing.api_key_hash = api_key_hash
            existing.updated_by = ctx.user_id
            self._db.flush()
            return existing, plaintext

        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            device_code=code,
            device_name=device_name,
            device_model=device_model,
            ip_address=ip_clean,
            port=port,
            subnet_mask=subnet_clean,
            gateway=gateway_clean,
            comm_password=comm_clean,
            location_text=location_text,
            status=status,
            api_key_hash=api_key_hash,
        )
        return row, plaintext

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Biometric device not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_biometric_device",
            entity_id=row_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def download_logs(self, ctx: TenantContext, row_id: UUID) -> dict:
        """Pull attendance from the K40 over TCP and store it as biometric attendance."""
        device = self.get(ctx, row_id)
        return self._fetch_punches_for_device(ctx, device)

    def _fetch_punches_for_device(self, ctx: TenantContext, device) -> dict:
        """TCP pull + ingest for one registered device row."""
        if device.status != "active":
            raise AppException("Biometric device is inactive")
        if ZK is None:
            raise AppException(
                "Biometric ZK library (pyzk) is not installed on this API server. "
                "Install pyzk to fetch device punches."
            )
        if not device.ip_address or not device.port:
            raise AppException("Set the device IP address and port before fetching punches.")
        password = int(str(device.comm_password or "0").strip() or "0")
        terminal = ZK(
            str(device.ip_address).strip(),
            port=int(device.port),
            timeout=8,
            password=password,
            force_udp=False,
            ommit_ping=True,
        )
        conn = None
        try:
            conn = terminal.connect()
            raw_logs = conn.get_attendance() or []
        except (OSError, ZKNetworkError, ZKErrorResponse) as exc:
            raise AppException(
                f"Cannot fetch punches from {device.ip_address}:{device.port}. {exc}"
            ) from exc
        finally:
            if conn is not None:
                try:
                    conn.disconnect()
                except (OSError, ZKNetworkError, ZKErrorResponse):
                    pass

        cutoff = datetime.now(_DEVICE_LOCAL_TZ) - timedelta(days=_LOG_LOOKBACK_DAYS)
        punch_payloads: list[dict] = []
        logs_read = 0
        for log in raw_logs:
            user_id = str(getattr(log, "user_id", "") or "").strip()
            stamped = getattr(log, "timestamp", None)
            if not user_id or stamped is None:
                continue
            if stamped.tzinfo is None:
                stamped = stamped.replace(tzinfo=_DEVICE_LOCAL_TZ)
            if stamped < cutoff:
                continue
            logs_read += 1
            punch_payloads.append(
                {
                    "employee_code": user_id.strip().upper(),
                    "attendance_date": stamped.date(),
                    "check_in_at": stamped,
                    "check_out_at": None,
                    "punch_events": [stamped],
                    "notes": f"biometric:{device.device_code}",
                }
            )

        result = self.device_sync(
            ctx,
            punches=punch_payloads,
            device_code=device.device_code,
            company_id=device.company_id,
            device_id=device.id,
            branch_id=device.branch_id,
        )
        result["logs_read"] = logs_read
        return result

    @classmethod
    def fetch_punches_all_active(cls, db: Session) -> dict:
        """Fetch punches from every active device with IP/port (worker / always-on script)."""
        from uuid import uuid4

        from sqlalchemy import select

        from modules.hr.models.biometric_device import HrBiometricDevice

        devices = list(
            db.scalars(
                select(HrBiometricDevice).where(
                    HrBiometricDevice.is_deleted.is_(False),
                    HrBiometricDevice.status == "active",
                    HrBiometricDevice.ip_address.is_not(None),
                    HrBiometricDevice.port.is_not(None),
                )
            ).all()
        )
        svc = cls(db)
        system_user = uuid4()
        summary = {
            "devices": len(devices),
            "ok": 0,
            "failed": 0,
            "logs_read": 0,
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [],
        }
        for device in devices:
            ctx = TenantContext(
                tenant_id=device.tenant_id,
                user_id=system_user,
                user_type="super_admin",
                company_id=device.company_id,
                branch_id=device.branch_id,
            )
            try:
                result = svc._fetch_punches_for_device(ctx, device)
                summary["ok"] += 1
                summary["logs_read"] += int(result.get("logs_read") or 0)
                summary["created"] += int(result.get("created") or 0)
                summary["updated"] += int(result.get("updated") or 0)
                summary["skipped"] += int(result.get("skipped") or 0)
            except Exception as exc:
                summary["failed"] += 1
                summary["errors"].append(
                    f"{device.device_code} ({device.ip_address}:{device.port}): {exc}"
                )
        return summary

    def rotate_api_key(self, ctx: TenantContext, device_id: UUID) -> str:
        row = self._repo.get(ctx, device_id)
        if row is None:
            raise NotFoundException("Biometric device not found")
        plaintext = secrets.token_urlsafe(32)
        self._repo.update(ctx, device_id, api_key_hash=hash_token(plaintext))
        return plaintext

    def verify_device_api_key(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None,
        device_code: str,
        api_key: str,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        device = self._repo.get_by_code(ctx, cid, device_code)
        if device is None:
            raise NotFoundException(f"Biometric device '{device_code}' not found")
        if device.status != "active":
            raise AppException("Biometric device is inactive")
        if not device.api_key_hash:
            raise AppException("Device has no API key configured")
        if not hmac.compare_digest(hash_token(api_key), device.api_key_hash):
            raise AppException("Invalid device API key")
        return device

    def device_sync(
        self,
        ctx: TenantContext,
        *,
        punches: list[dict],
        device_code: str | None = None,
        company_id: UUID | None = None,
        api_key: str | None = None,
        device_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> dict:
        """Store every punch, then rebuild each emp+date from ALL devices + attendance policy."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        device = None
        if device_code and api_key:
            device = self.verify_device_api_key(
                ctx, company_id=cid, device_code=device_code, api_key=api_key
            )
        elif device_code:
            device = self._repo.get_by_code(ctx, cid, device_code)
            if device is None:
                raise NotFoundException(f"Biometric device '{device_code}' not found")
            if device.status != "active":
                raise AppException("Biometric device is inactive")

        resolved_device_id = device_id or (device.id if device else None)
        resolved_device_code = (device.device_code if device else None) or device_code or "UNKNOWN"
        resolved_branch_id = branch_id or (device.branch_id if device else None)

        punch_created = 0
        punch_existing = 0
        skipped = 0
        rebuild_keys: set[tuple[UUID, date, UUID]] = set()  # emp_id, date, branch_id

        for punch in punches:
            employee_id = punch.get("employee_id")
            employee_code = punch.get("employee_code")
            attendance_date = punch.get("attendance_date")
            if (not employee_id and not employee_code) or not attendance_date:
                skipped += 1
                continue
            if isinstance(attendance_date, str):
                attendance_date = date.fromisoformat(attendance_date[:10])

            emp = None
            code_raw = str(employee_code or "").strip().upper()
            try:
                if employee_id:
                    emp = self._master.get_employee(ctx, UUID(str(employee_id)))
                    code_raw = str(getattr(emp, "employee_code", None) or code_raw).strip().upper()
                else:
                    emp = self._master.get_employee_by_code(ctx, cid, code_raw)
            except Exception:
                emp = None

            events = punch.get("punch_events") or []
            if not isinstance(events, list):
                events = []
            stamps: list[datetime] = []
            for ev in events:
                if isinstance(ev, datetime):
                    stamps.append(ev)
                else:
                    try:
                        stamps.append(datetime.fromisoformat(str(ev).replace("Z", "+00:00")))
                    except ValueError:
                        continue
            for key in ("check_in_at", "check_out_at"):
                raw = punch.get(key)
                if isinstance(raw, datetime):
                    stamps.append(raw)
                elif raw:
                    try:
                        stamps.append(datetime.fromisoformat(str(raw).replace("Z", "+00:00")))
                    except ValueError:
                        pass
            # Deduplicate while preserving order
            seen: set[datetime] = set()
            unique_stamps: list[datetime] = []
            for ts in stamps:
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=_DEVICE_LOCAL_TZ)
                if ts in seen:
                    continue
                seen.add(ts)
                unique_stamps.append(ts)
            if not unique_stamps:
                skipped += 1
                continue

            emp_branch = resolved_branch_id
            if emp is not None:
                emp_branch = UUID(str(punch.get("branch_id") or emp.branch_id or resolved_branch_id))
            if emp_branch is None:
                skipped += 1
                continue

            for stamped in unique_stamps:
                day = stamped.date() if attendance_date is None else attendance_date
                # Prefer the punch's own calendar day when events span midnights.
                day = stamped.astimezone(_DEVICE_LOCAL_TZ).date()
                _, created_flag = self._punches.upsert(
                    ctx,
                    company_id=cid,
                    branch_id=emp_branch,
                    device_id=resolved_device_id,
                    device_code=str(resolved_device_code),
                    employee_id=emp.id if emp else None,
                    employee_code_raw=code_raw or "UNKNOWN",
                    punched_at=stamped,
                    attendance_date=day,
                    notes=punch.get("notes") or f"biometric:{resolved_device_code}",
                )
                if created_flag:
                    punch_created += 1
                else:
                    punch_existing += 1
                if emp is not None:
                    rebuild_keys.add((emp.id, day, emp_branch))

        created = 0
        updated = 0
        for emp_id, att_date, emp_branch in rebuild_keys:
            result = self._rebuild_attendance_day(
                ctx,
                company_id=cid,
                branch_id=emp_branch,
                employee_id=emp_id,
                attendance_date=att_date,
            )
            if result == "created":
                created += 1
            elif result == "updated":
                updated += 1
            elif result == "skipped":
                skipped += 1

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_attendance",
            entity_id=cid,
            operation="device_sync",
            performed_by=ctx.user_id,
            new_value={
                "created": created,
                "updated": updated,
                "skipped": skipped,
                "punch_created": punch_created,
                "punch_existing": punch_existing,
                "device_code": resolved_device_code,
            },
        )
        return {
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "punch_created": punch_created,
            "punch_existing": punch_existing,
            "total": len(punches),
        }

    def _rebuild_attendance_day(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        employee_id: UUID,
        attendance_date: date,
    ) -> str:
        """Merge all stored punches for emp+date and apply attendance policy / shift."""
        punch_rows = self._punches.list_for_employee_date(
            ctx,
            company_id=company_id,
            employee_id=employee_id,
            attendance_date=attendance_date,
        )
        if not punch_rows:
            return "skipped"

        events = [p.punched_at for p in punch_rows]
        device_codes = sorted({p.device_code for p in punch_rows if p.device_code})
        shift_id = self.resolve_shift_for_employee(
            ctx, company_id, employee_id, attendance_date
        )
        rule = self._policy.resolve_rule_for_employee(ctx, company_id, employee_id)
        aggregated = self._policy.aggregate_punches(rule, events=events)
        applied = self._policy.apply_to_fields(
            ctx,
            company_id,
            employee_id,
            {
                "check_in_at": aggregated.get("check_in_at"),
                "check_out_at": aggregated.get("check_out_at"),
                "total_hours": aggregated.get("total_hours"),
                "attendance_status": "present",
                "shift_id": shift_id,
            },
            rule=rule,
            punch_events=events,
        )

        # Prior days with only one punch → miss_punch; same-day stays present/late until checkout.
        status = applied.get("attendance_status") or "present"
        if (
            applied.get("check_in_at")
            and not applied.get("check_out_at")
            and status in {"present", "late"}
            and len(events) == 1
            and attendance_date < date.today()
        ):
            status = "miss_punch"

        note_parts = [
            f"biometric:{','.join(device_codes)}" if device_codes else "biometric",
            f"punches={len(events)}",
        ]
        if aggregated.get("sessions"):
            note_parts.append(f"mode_sessions={len(aggregated['sessions'])}")
        if shift_id:
            note_parts.append(f"shift={shift_id}")

        fields = {
            "attendance_status": status,
            "source": AttendanceSource.BIOMETRIC.value,
            "check_in_at": applied.get("check_in_at"),
            # Keep None so rebuild can clear a stale checkout when only one punch remains.
            "check_out_at": applied.get("check_out_at"),
            "total_hours": (
                Decimal(str(applied["total_hours"]))
                if applied.get("total_hours") is not None
                else None
            ),
            "late_minutes": applied.get("late_minutes"),
            "shift_id": shift_id,
            "notes": " | ".join(note_parts),
        }

        existing = None
        for cand in self._attendance.list_rows(ctx, company_id):
            if cand.employee_id == employee_id and cand.attendance_date == attendance_date:
                existing = cand
                break

        if existing:
            if getattr(existing, "status", None) == "locked":
                return "skipped"
            # Pass explicit keys (including None) so update merge can replace stale values.
            self._attendance_svc.update(ctx, existing.id, **fields)
            return "updated"

        create_fields = {k: v for k, v in fields.items() if v is not None}
        self._attendance_svc.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            employee_id=employee_id,
            attendance_date=attendance_date,
            status="recorded",
            **create_fields,
        )
        return "created"
