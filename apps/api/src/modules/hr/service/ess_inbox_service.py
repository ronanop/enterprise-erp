"""Unified HR inbox for ESS-originated approvals (leave, comp off, attendance regularization, OT)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.schemas import HrEssInboxItemResponse
from modules.hr.service.attendance_correction_service import AttendanceCorrectionService
from modules.hr.service.compoff_bio_service import CompoffRequestService
from modules.hr.service.hr_scope_validator import HrScopeValidator
from modules.hr.service.leave_service import LeaveRequestService
from modules.hr.service.on_duty_ot_service import OnDutyRequestService, OtAllotmentService


def _emp_name(master: HrMasterDataAdapter, ctx: TenantContext, employee_id: UUID) -> str:
    try:
        emp = master.get_employee(ctx, employee_id)
        parts = [getattr(emp, "first_name", None), getattr(emp, "last_name", None)]
        name = " ".join(p for p in parts if p).strip()
        code = getattr(emp, "employee_code", None)
        if name and code:
            return f"{name} ({code})"
        return name or str(code or employee_id)
    except Exception:
        return str(employee_id)


def _leave_actions(status: str) -> list[str]:
    st = status.lower()
    if st == "submitted":
        return ["manager-approve", "reject"]
    if st == "manager_approved":
        return ["approve", "reject"]
    return []


def _compoff_actions(status: str) -> list[str]:
    st = status.lower()
    if st == "submitted":
        return ["manager-approve", "reject"]
    if st == "manager_approved":
        return ["approve", "reject"]
    return []


def _correction_actions(status: str) -> list[str]:
    if status.lower() == "submitted":
        return ["approve", "reject"]
    return []


def _ot_actions(status: str) -> list[str]:
    if status.lower() in {"submitted", "pending"}:
        return ["approve", "reject"]
    return []


def _on_duty_actions(status: str) -> list[str]:
    if status.lower() == "submitted":
        return ["approve", "reject"]
    return []


class HrEssInboxService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._leave = LeaveRequestService(db)
        self._compoff = CompoffRequestService(db)
        self._corrections = AttendanceCorrectionService(db)
        self._ot = OtAllotmentService(db)
        self._on_duty = OnDutyRequestService(db)

    def list_inbox(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        include_decided_days: int = 14,
    ) -> list[HrEssInboxItemResponse]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        cutoff = datetime.now(timezone.utc) - timedelta(days=include_decided_days)
        items: list[HrEssInboxItemResponse] = []

        for row in self._leave.list(ctx, cid):
            st = str(row.status)
            pending = st in {"submitted", "manager_approved", "pending"}
            decided = getattr(row, "decided_at", None)
            created = getattr(row, "created_at", None) or decided
            if not pending:
                if decided is None or decided < cutoff:
                    continue
            occurred = decided or created or datetime.now(timezone.utc)
            items.append(
                HrEssInboxItemResponse(
                    id=f"leave:{row.id}",
                    source_id=row.id,
                    category="leave",
                    status=st,
                    title=f"Leave request {row.document_number}",
                    employee_id=row.employee_id,
                    employee_name=_emp_name(self._master, ctx, row.employee_id),
                    document_number=str(row.document_number),
                    occurred_at=occurred,
                    detail=(
                        f"{row.start_date} → {row.end_date} · "
                        f"{row.days_count} day(s)"
                        + (f" · {row.reason}" if getattr(row, "reason", None) else "")
                    ),
                    pending=pending,
                    available_actions=_leave_actions(st),
                    api_path="/hr/leave-requests",
                )
            )

        for row in self._compoff.list(ctx, cid):
            st = str(row.status)
            pending = st in {"submitted", "manager_approved"}
            decided = getattr(row, "decided_at", None)
            created = getattr(row, "created_at", None) or decided
            if not pending:
                if decided is None or decided < cutoff:
                    continue
            occurred = decided or created or datetime.now(timezone.utc)
            items.append(
                HrEssInboxItemResponse(
                    id=f"compoff:{row.id}",
                    source_id=row.id,
                    category="compoff",
                    status=st,
                    title="Comp Off (overtime)",
                    employee_id=row.employee_id,
                    employee_name=_emp_name(self._master, ctx, row.employee_id),
                    document_number=None,
                    occurred_at=occurred,
                    detail=(
                        f"Earned {row.earned_date} · {row.extra_hours}h OT → "
                        f"{row.requested_days} day(s)"
                        + (f" · {row.reason}" if row.reason else "")
                    ),
                    pending=pending,
                    available_actions=_compoff_actions(st),
                    api_path="/hr/compoff-requests",
                )
            )

        for row in self._corrections.list(ctx, cid):
            st = str(row.status)
            pending = st == "submitted"
            decided = getattr(row, "decided_at", None)
            created = getattr(row, "created_at", None) or decided
            if not pending:
                if decided is None or decided < cutoff:
                    continue
            occurred = decided or created or datetime.now(timezone.utc)
            items.append(
                HrEssInboxItemResponse(
                    id=f"correction:{row.id}",
                    source_id=row.id,
                    category="attendance_correction",
                    status=st,
                    title="Attendance regularization",
                    employee_id=row.employee_id,
                    employee_name=_emp_name(self._master, ctx, row.employee_id),
                    document_number=None,
                    occurred_at=occurred,
                    detail=(
                        f"{row.attendance_date} · {row.field_name} → {row.new_value}"
                        + (f" · {row.reason}" if getattr(row, "reason", None) else "")
                    ),
                    pending=pending,
                    available_actions=_correction_actions(st),
                    api_path="/hr/attendance-corrections",
                )
            )

        for row in self._ot.list(ctx, cid):
            st = str(row.status)
            pending = st == "submitted"
            decided = getattr(row, "decided_at", None)
            created = getattr(row, "created_at", None) or decided
            if not pending:
                if decided is None or decided < cutoff:
                    continue
            occurred = decided or created or datetime.now(timezone.utc)
            ot_type = getattr(row, "allotment_type", "overtime")
            items.append(
                HrEssInboxItemResponse(
                    id=f"ot:{row.id}",
                    source_id=row.id,
                    category="ot_allotment",
                    status=st,
                    title=f"OT / Overday — {ot_type}",
                    employee_id=row.employee_id,
                    employee_name=_emp_name(self._master, ctx, row.employee_id),
                    document_number=getattr(row, "document_number", None),
                    occurred_at=occurred,
                    detail=(
                        f"{getattr(row, 'allotment_date', '')} · "
                        f"{getattr(row, 'hours', '')}h"
                    ),
                    pending=pending,
                    available_actions=_ot_actions(st),
                    api_path="/hr/ot-allotments",
                )
            )

        for row in self._on_duty.list(ctx, cid):
            st = str(row.status)
            pending = st == "submitted"
            decided = getattr(row, "decided_at", None)
            created = getattr(row, "created_at", None) or decided
            if not pending:
                if decided is None or decided < cutoff:
                    continue
            occurred = decided or created or datetime.now(timezone.utc)
            items.append(
                HrEssInboxItemResponse(
                    id=f"onduty:{row.id}",
                    source_id=row.id,
                    category="on_duty",
                    status=st,
                    title="On duty request",
                    employee_id=row.employee_id,
                    employee_name=_emp_name(self._master, ctx, row.employee_id),
                    document_number=None,
                    occurred_at=occurred,
                    detail=f"{row.duty_date} · {row.portion}"
                    + (f" · {row.purpose}" if getattr(row, "purpose", None) else ""),
                    pending=pending,
                    available_actions=_on_duty_actions(st),
                    api_path="/hr/on-duty-requests",
                )
            )

        items.sort(key=lambda x: (not x.pending, -x.occurred_at.timestamp()))
        return items
