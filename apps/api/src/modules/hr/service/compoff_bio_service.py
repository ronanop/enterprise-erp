"""Comp Off Emp→Mgr→HR allocation + biometric device sync services."""

from __future__ import annotations

import hmac
import secrets
import socket
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.base import hash_token
from modules.foundation.service.audit_service import AuditService
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import AttendanceSource
from modules.hr.domain.exceptions import InvalidLeaveRequestState
from modules.hr.schemas import BiometricDeviceFeedResponse, BiometricDeviceLiveLogItem, BiometricDeviceResponse
from modules.hr.repository.attendance_repository import AttendanceRepository
from modules.hr.repository.compoff_bio_repository import (
    BiometricDeviceRepository,
    CompoffRequestRepository,
)
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
        self._audit = AuditService(db)

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


class BiometricDeviceService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = BiometricDeviceRepository(db)
        self._attendance = AttendanceRepository(db)
        self._attendance_svc = AttendanceService(db)
        self._policy = AttendancePolicyApplyService(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._audit = AuditService(db)

    @staticmethod
    def _probe_device(ip: str | None, port: int | None) -> tuple[bool, str]:
        if not ip or not port:
            return False, "Configure IP and port to connect to the device."
        try:
            with socket.create_connection((str(ip).strip(), int(port)), timeout=3):
                return True, f"Device reachable at {ip}:{port}"
        except OSError as exc:
            return False, f"Cannot reach {ip}:{port} — {exc}"

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Biometric device not found")
        return row

    def live_feed(self, ctx: TenantContext, row_id: UUID, *, days: int = 14) -> BiometricDeviceFeedResponse:
        device = self.get(ctx, row_id)
        reachable, reachability_message = self._probe_device(device.ip_address, device.port)
        cid = device.company_id
        cutoff = date.today() - timedelta(days=max(1, min(days, 90)))
        tag = f"biometric:{device.device_code}"
        today = date.today()
        ingested: list[BiometricDeviceLiveLogItem] = []
        today_count = 0

        for row in self._attendance.list_rows(ctx, cid):
            if row.source != AttendanceSource.BIOMETRIC.value:
                continue
            notes = row.notes or ""
            if tag not in notes and device.device_code not in notes:
                continue
            if row.attendance_date < cutoff:
                continue
            emp_name: str | None = None
            emp_code: str | None = None
            try:
                emp = self._master.get_employee(ctx, row.employee_id)
                emp_name = " ".join(
                    p for p in (getattr(emp, "first_name", None), getattr(emp, "last_name", None)) if p
                ).strip() or None
                emp_code = str(getattr(emp, "employee_code", None) or "") or None
            except Exception:
                pass
            if row.attendance_date == today:
                today_count += 1
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
            today_ingested_count=today_count,
            ingested_records=ingested[:100],
        )

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
        location_text: str | None = None,
        status: str = "active",
        generate_api_key: bool = True,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        if device_model not in {"fingerprint_k40_timelabs"}:
            raise AppException(f"Unsupported biometric device model: {device_model}")
        if ip_address is not None and not str(ip_address).strip():
            ip_address = None
        if port is not None and (port < 1 or port > 65535):
            raise AppException("Port must be between 1 and 65535")
        plaintext: str | None = None
        api_key_hash = None
        if generate_api_key:
            plaintext = secrets.token_urlsafe(32)
            api_key_hash = hash_token(plaintext)
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            device_code=device_code,
            device_name=device_name,
            device_model=device_model,
            ip_address=ip_address.strip() if ip_address else None,
            port=port,
            location_text=location_text,
            status=status,
            api_key_hash=api_key_hash,
        )
        return row, plaintext

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
    ) -> dict:
        """Ingest biometric punches → attendance rows with source=biometric (idempotent by emp+date)."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        if device_code and api_key:
            self.verify_device_api_key(ctx, company_id=cid, device_code=device_code, api_key=api_key)
        elif device_code:
            device = self._repo.get_by_code(ctx, cid, device_code)
            if device is None:
                raise NotFoundException(f"Biometric device '{device_code}' not found")
            if device.status != "active":
                raise AppException("Biometric device is inactive")

        created = 0
        updated = 0
        skipped = 0
        for punch in punches:
            employee_id = punch.get("employee_id")
            employee_code = punch.get("employee_code")
            attendance_date = punch.get("attendance_date")
            if (not employee_id and not employee_code) or not attendance_date:
                skipped += 1
                continue
            if isinstance(attendance_date, str):
                attendance_date = date.fromisoformat(attendance_date[:10])
            try:
                if employee_id:
                    emp = self._master.get_employee(ctx, UUID(str(employee_id)))
                else:
                    emp = self._master.get_employee_by_code(ctx, cid, str(employee_code))
            except Exception:
                skipped += 1
                continue
            existing = None
            for cand in self._attendance.list_rows(ctx, cid):
                if cand.employee_id == emp.id and cand.attendance_date == attendance_date:
                    existing = cand
                    break

            events = punch.get("punch_events") or []
            if not isinstance(events, list):
                events = []

            rule = self._policy.resolve_rule_for_employee(ctx, cid, emp.id)
            shift_id_raw = punch.get("shift_id")
            aggregated = self._policy.aggregate_punches(
                rule,
                events=events,
                check_in_at=punch.get("check_in_at"),
                check_out_at=punch.get("check_out_at"),
            )
            applied = self._policy.apply_to_fields(
                ctx,
                cid,
                emp.id,
                {
                    "check_in_at": aggregated.get("check_in_at") or punch.get("check_in_at"),
                    "check_out_at": aggregated.get("check_out_at") or punch.get("check_out_at"),
                    "total_hours": aggregated.get("total_hours"),
                    "attendance_status": punch.get("attendance_status") or "present",
                    "shift_id": UUID(str(shift_id_raw)) if shift_id_raw else None,
                },
                rule=rule,
            )
            check_in_at = applied.get("check_in_at")
            check_out_at = applied.get("check_out_at")
            total_hours = applied.get("total_hours")
            status = applied.get("attendance_status") or "present"
            late_minutes = applied.get("late_minutes")

            note_parts = [
                punch.get("notes") or (f"biometric:{device_code}" if device_code else "biometric"),
            ]
            if aggregated.get("punch_count"):
                note_parts.append(f"punches={aggregated['punch_count']}")
            if aggregated.get("sessions"):
                note_parts.append(f"mode_sessions={len(aggregated['sessions'])}")

            fields = {
                "attendance_status": status or "present",
                "source": AttendanceSource.BIOMETRIC.value,
                "check_in_at": check_in_at,
                "check_out_at": check_out_at,
                "total_hours": Decimal(str(total_hours)) if total_hours is not None else None,
                "late_minutes": late_minutes,
                "notes": " | ".join(str(p) for p in note_parts if p),
            }
            fields = {k: v for k, v in fields.items() if v is not None}
            if existing:
                if getattr(existing, "status", None) == "locked":
                    skipped += 1
                    continue
                self._attendance_svc.update(ctx, existing.id, **fields)
                updated += 1
            else:
                self._attendance_svc.create(
                    ctx,
                    company_id=cid,
                    branch_id=UUID(str(punch.get("branch_id") or emp.branch_id)),
                    employee_id=emp.id,
                    attendance_date=attendance_date,
                    status="recorded",
                    **fields,
                )
                created += 1

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_attendance",
            entity_id=cid,
            operation="device_sync",
            performed_by=ctx.user_id,
            new_value={"created": created, "updated": updated, "skipped": skipped, "device_code": device_code},
        )
        return {"created": created, "updated": updated, "skipped": skipped, "total": len(punches)}
