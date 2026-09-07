"""HR leave-adjust: preview plan, confirm against CL/SL/EL, history, revert."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import HrEntityType, LeaveRequestStatus
from modules.hr.domain.leave_accrual_calendar import leave_financial_year, leave_financial_year_label
from modules.hr.domain.leave_adjust_plan import (
    LeavePool,
    PlanDay,
    allocate_leave_days,
    canonical_leave_pool_code,
    leave_pool_rank,
    ranked_paid_pools,
)
from modules.hr.models import HrLeaveRequest
from modules.hr.repository.attendance_repository import AttendanceRepository
from modules.hr.repository.employment_repository import EmploymentRepository
from modules.hr.repository.leave_adjust_event_repository import LeaveAdjustEventRepository
from modules.hr.repository.leave_balance_repository import LeaveBalanceRepository
from modules.hr.repository.leave_request_repository import LeaveRequestRepository
from modules.hr.repository.leave_type_repository import LeaveTypeRepository
from modules.hr.service.document_number_service import DocumentNumberService
from modules.hr.service.engines.leave_balance_engine import LeaveBalanceEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator
from modules.payroll.domain.payroll_day_ledger import iter_dates_inclusive
from modules.payroll.repository.payroll_run_repository import PayrollRunRepository
from modules.payroll.service.payroll_period_day_service import PayrollPeriodDayService

PAID_STATUSES = {"present", "late", "work_from_home", "on_duty", "miss_punch"}
ABSENT_STATUSES = {"absent"}
HALF_STATUSES = {"half_day"}
LOCKED_RUN_STATUSES = {"locked", "approved", "posted", "paid", "cancelled"}


def _missing_relation(exc: ProgrammingError) -> bool:
    detail = str(getattr(exc, "orig", None) or exc).lower()
    return "does not exist" in detail or "undefinedcolumn" in detail or "undefinedtable" in detail


def _jsonable(value: object) -> object:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


class LeaveAdjustService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._employment = EmploymentRepository(db)
        self._attendance = AttendanceRepository(db)
        self._types = LeaveTypeRepository(db)
        self._balances = LeaveBalanceRepository(db)
        self._leave = LeaveRequestRepository(db)
        self._events = LeaveAdjustEventRepository(db)
        self._days = PayrollPeriodDayService(db)
        self._runs = PayrollRunRepository(db)
        self._numbers = DocumentNumberService(db)
        self._balance_engine = LeaveBalanceEngine()
        self._audit = AuditService(db)

    def _open_events(self, ctx, **kwargs):
        try:
            return self._events.list_open_for_employee(ctx, **kwargs)
        except ProgrammingError as exc:
            if not _missing_relation(exc):
                raise
            self._db.rollback()
            return []

    def _history_rows(self, ctx, **kwargs):
        try:
            return self._events.list_history(ctx, **kwargs)
        except ProgrammingError as exc:
            if not _missing_relation(exc):
                raise
            self._db.rollback()
            return []

    def preview(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID,
        period_start: date,
        period_end: date,
        company_id: UUID | None = None,
    ) -> dict:
        ctx_plan = self._build_context(ctx, employee_id, period_start, period_end, company_id)
        return self._serialize_preview(ctx_plan)

    def apply_day(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID,
        period_start: date,
        period_end: date,
        attendance_date: date,
        leave_type_code: str,
        company_id: UUID | None = None,
        source: str = "attendance_tab",
        payroll_run_id: UUID | None = None,
        reason: str | None = None,
    ) -> dict:
        src = source if source in {"attendance_tab", "payroll_run"} else "attendance_tab"
        self._assert_run_unlocked(ctx, payroll_run_id)
        if attendance_date < period_start or attendance_date > period_end:
            raise AppException("Date is outside the selected period")
        want_rank = leave_pool_rank(leave_type_code)
        if want_rank not in (0, 1):
            raise AppException("Mark as casual leave or sick leave only")

        plan_ctx = self._build_context(ctx, employee_id, period_start, period_end, company_id)
        employment = plan_ctx["employment"]
        cid = plan_ctx["company_id"]
        branch_id = employment.branch_id
        if branch_id is None:
            raise AppException("Employee has no branch — cannot mark leave")

        day = next((d for d in plan_ctx["planned"] if d.attendance_date == attendance_date), None)
        if day is None:
            raise NotFoundException("Day not found in this period")
        if not self._can_mark_day(day):
            raise AppException("This day cannot be marked as casual or sick leave")

        types = {t.id: t for t in self._types.list_rows(ctx, cid)}
        chosen = None
        for lt in types.values():
            if str(lt.status).lower() != "active" or not bool(lt.is_paid):
                continue
            if leave_pool_rank(lt.leave_type_code) == want_rank:
                chosen = lt
                break
        if chosen is None:
            raise AppException("Casual or sick leave type is not set up for this company")

        covering = self._approved_leave_on(ctx, cid, employee_id, attendance_date)
        if covering is not None:
            cov_type = types.get(covering.leave_type_id)
            if leave_pool_rank(cov_type.leave_type_code if cov_type else "") in (0, 1, 2):
                raise AppException("This day already has approved paid leave")

        need = Decimal(str(day.days)) if Decimal(str(day.days or 0)) > 0 else Decimal("1")
        fy = leave_financial_year(attendance_date)
        balance = self._open_balance(ctx, cid, employee_id, chosen.id, fy)
        if balance is None:
            raise NotFoundException(
                f"Open leave balance not found for {chosen.leave_type_code} in financial year "
                f"{leave_financial_year_label(fy)}"
            )
        remaining = Decimal(str(balance.closing_balance or 0))
        if remaining < need:
            raise AppException(
                f"Not enough {chosen.leave_type_name} remaining in FY {leave_financial_year_label(fy)} "
                f"({remaining} left)"
            )

        now = datetime.now(timezone.utc)
        before = remaining
        after = remaining - need
        doc = self._numbers.generate(HrEntityType.LEAVE_REQUEST, cid, HrLeaveRequest, "document_number")
        req = self._leave.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            document_number=doc,
            leave_type_id=chosen.id,
            start_date=attendance_date,
            end_date=attendance_date,
            days_count=need,
            reason=reason or "HR marked casual/sick leave",
            status=LeaveRequestStatus.APPROVED.value,
            decided_at=now,
            hr_approver_id=ctx.user_id,
        )
        self._balance_engine.apply_usage(balance, need)
        self._balances.update(
            ctx,
            balance.id,
            used=balance.used,
            closing_balance=balance.closing_balance,
        )

        existing = next(
            (
                e
                for e in self._open_events(
                    ctx,
                    employee_id=employee_id,
                    period_start=period_start,
                    period_end=period_end,
                    company_id=cid,
                )
                if e.attendance_date == attendance_date
            ),
            None,
        )
        try:
            if existing is not None:
                self._events.update(
                    ctx,
                    existing.id,
                    leave_type_id=chosen.id,
                    days=need,
                    result="adjusted",
                    balance_before=before,
                    balance_after=after,
                    leave_request_id=req.id,
                    confirmed_by=ctx.user_id,
                    confirmed_at=now,
                    reason=reason or "HR marked casual/sick leave",
                )
            else:
                self._events.create(
                    ctx,
                    company_id=cid,
                    branch_id=branch_id,
                    employee_id=employee_id,
                    attendance_date=attendance_date,
                    leave_type_id=chosen.id,
                    days=need,
                    result="adjusted",
                    balance_before=before,
                    balance_after=after,
                    period_start=period_start,
                    period_end=period_end,
                    source=src,
                    payroll_run_id=payroll_run_id,
                    leave_request_id=req.id,
                    confirmed_by=ctx.user_id,
                    confirmed_at=now,
                    reason=reason or "HR marked casual/sick leave",
                )
        except ProgrammingError as exc:
            if not _missing_relation(exc):
                raise
            self._db.rollback()
            raise AppException(
                "Leave-adjust history table is missing. Run the hr_leave_adjust_event migration."
            ) from exc

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_adjust_event",
            entity_id=employee_id,
            operation="apply_day",
            performed_by=ctx.user_id,
            new_value={
                "attendance_date": str(attendance_date),
                "leave_type_code": chosen.leave_type_code,
            },
        )
        refreshed = self._build_context(ctx, employee_id, period_start, period_end, company_id)
        return self._serialize_preview(refreshed)

    def confirm(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID,
        period_start: date,
        period_end: date,
        company_id: UUID | None = None,
        source: str = "attendance_tab",
        payroll_run_id: UUID | None = None,
        reason: str | None = None,
    ) -> dict:
        src = source if source in {"attendance_tab", "payroll_run"} else "attendance_tab"
        self._assert_run_unlocked(ctx, payroll_run_id)
        plan_ctx = self._build_context(ctx, employee_id, period_start, period_end, company_id)
        employment = plan_ctx["employment"]
        cid = plan_ctx["company_id"]
        branch_id = employment.branch_id
        if branch_id is None:
            raise AppException("Employee has no branch — cannot confirm leave adjust")

        to_write = [
            d
            for d in plan_ctx["planned"]
            if d.kind == "candidate" and not d.already_adjusted
        ]
        if not to_write:
            return {**self._serialize_preview(plan_ctx), "confirmed": 0}

        now = datetime.now(timezone.utc)
        pools_map = {p.leave_type_id: Decimal(str(p.remaining)) for p in plan_ctx["pools_before"]}
        grouped = self._group_adjusted(to_write)
        request_ids: dict[tuple, UUID] = {}

        for group in grouped:
            if group["result"] != "adjusted" or group["leave_type_id"] is None:
                continue
            doc = self._numbers.generate(
                HrEntityType.LEAVE_REQUEST, cid, HrLeaveRequest, "document_number"
            )
            row = self._leave.create(
                ctx,
                company_id=cid,
                branch_id=branch_id,
                employee_id=employee_id,
                document_number=doc,
                leave_type_id=group["leave_type_id"],
                start_date=group["start"],
                end_date=group["end"],
                days_count=group["days"],
                reason=reason or "HR leave adjust (auto)",
                status=LeaveRequestStatus.APPROVED.value,
                decided_at=now,
                hr_approver_id=ctx.user_id,
            )
            request_ids[(group["start"], group["end"], group["leave_type_id"])] = row.id

        used_by: dict[tuple[UUID, int], Decimal] = {}
        for day in to_write:
            if day.proposed_result == "adjusted" and day.proposed_type_id:
                key = (day.proposed_type_id, leave_financial_year(day.attendance_date))
                used_by[key] = used_by.get(key, Decimal("0")) + Decimal(str(day.days))

        for (type_id, year), used_days in used_by.items():
            balance = self._open_balance(ctx, cid, employee_id, type_id, year)
            if balance is None:
                raise NotFoundException("Open leave balance not found for adjust")
            self._balance_engine.apply_usage(balance, used_days)
            self._balances.update(
                ctx,
                balance.id,
                used=balance.used,
                closing_balance=balance.closing_balance,
            )

        confirmed = 0
        for day in to_write:
            before = None
            after = None
            req_id = None
            if day.proposed_type_id:
                before = pools_map.get(day.proposed_type_id)
                after = (before - Decimal(str(day.days))) if before is not None else None
                if before is not None:
                    pools_map[day.proposed_type_id] = after
                for key, rid in request_ids.items():
                    start, end, tid = key
                    if tid == day.proposed_type_id and start <= day.attendance_date <= end:
                        req_id = rid
                        break
            try:
                self._events.create(
                    ctx,
                    company_id=cid,
                    branch_id=branch_id,
                    employee_id=employee_id,
                    attendance_date=day.attendance_date,
                    leave_type_id=day.proposed_type_id,
                    days=Decimal(str(day.days)),
                    result=day.proposed_result,
                    balance_before=before,
                    balance_after=after,
                    period_start=period_start,
                    period_end=period_end,
                    source=src,
                    payroll_run_id=payroll_run_id,
                    leave_request_id=req_id,
                    confirmed_by=ctx.user_id,
                    confirmed_at=now,
                    reason=reason or "HR leave adjust (auto)",
                )
            except ProgrammingError as exc:
                if not _missing_relation(exc):
                    raise
                self._db.rollback()
                raise AppException(
                    "Leave-adjust history table is missing. Run the hr_leave_adjust_event migration."
                ) from exc
            confirmed += 1

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_adjust_event",
            entity_id=employee_id,
            operation="confirm",
            performed_by=ctx.user_id,
            new_value={"period_start": str(period_start), "period_end": str(period_end), "count": confirmed},
        )
        refreshed = self._build_context(ctx, employee_id, period_start, period_end, company_id)
        return {**self._serialize_preview(refreshed), "confirmed": confirmed}

    def history(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID | None = None,
        period_start: date | None = None,
        period_end: date | None = None,
        company_id: UUID | None = None,
        payroll_run_id: UUID | None = None,
    ) -> list[dict]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        types = {t.id: t for t in self._types.list_rows(ctx, cid)}
        rows = self._history_rows(
            ctx,
            employee_id=employee_id,
            period_start=period_start,
            period_end=period_end,
            company_id=cid,
            payroll_run_id=payroll_run_id,
        )
        out = []
        for row in rows:
            lt = types.get(row.leave_type_id) if row.leave_type_id else None
            out.append(
                {key: _jsonable(val) for key, val in {
                    "id": row.id,
                    "employee_id": row.employee_id,
                    "attendance_date": row.attendance_date,
                    "leave_type_id": row.leave_type_id,
                    "leave_type_code": lt.leave_type_code if lt else None,
                    "leave_type_name": lt.leave_type_name if lt else None,
                    "days": row.days,
                    "result": row.result,
                    "balance_before": row.balance_before,
                    "balance_after": row.balance_after,
                    "period_start": row.period_start,
                    "period_end": row.period_end,
                    "source": row.source,
                    "payroll_run_id": row.payroll_run_id,
                    "confirmed_by": row.confirmed_by,
                    "confirmed_at": row.confirmed_at,
                    "reverted_at": row.reverted_at,
                    "reason": row.reason,
                }.items()}
            )
        return out

    def revert(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID,
        period_start: date,
        period_end: date,
        company_id: UUID | None = None,
        payroll_run_id: UUID | None = None,
    ) -> dict:
        self._assert_run_unlocked(ctx, payroll_run_id)
        cid = self._scope.resolve_company_id(ctx, company_id)
        emp = self._master.get_employee(ctx, employee_id)
        if emp is None:
            raise NotFoundException("Employee not found")
        rows = [
            r
            for r in self._open_events(
                ctx,
                employee_id=employee_id,
                period_start=period_start,
                period_end=period_end,
                company_id=cid,
            )
        ]
        if not rows:
            raise AppException("No leave-adjust events to revert")
        now = datetime.now(timezone.utc)
        restore: dict[tuple[UUID, int], Decimal] = {}
        request_ids: set[UUID] = set()
        for row in rows:
            if row.result == "adjusted" and row.leave_type_id:
                fy = leave_financial_year(row.attendance_date)
                restore[(row.leave_type_id, fy)] = restore.get(
                    (row.leave_type_id, fy), Decimal("0")
                ) + Decimal(str(row.days))
            if row.leave_request_id:
                request_ids.add(row.leave_request_id)
            self._events.update(ctx, row.id, reverted_at=now)

        for (type_id, year), days in restore.items():
            balance = self._open_balance(ctx, cid, employee_id, type_id, year)
            if balance is None:
                continue
            used = Decimal(str(balance.used or 0)) - Decimal(str(days))
            if used < 0:
                used = Decimal("0")
            balance.used = used
            balance.closing_balance = (
                Decimal(str(balance.opening_balance or 0))
                + Decimal(str(balance.accrued or 0))
                - used
            )
            self._balances.update(
                ctx,
                balance.id,
                used=balance.used,
                closing_balance=balance.closing_balance,
            )

        for req_id in request_ids:
            req = self._leave.get(ctx, req_id)
            if req is not None and req.status != LeaveRequestStatus.CANCELLED.value:
                self._leave.update(ctx, req_id, status=LeaveRequestStatus.CANCELLED.value)

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_adjust_event",
            entity_id=employee_id,
            operation="revert",
            performed_by=ctx.user_id,
            new_value={"count": len(rows)},
        )
        return {"reverted": len(rows)}

    def _assert_run_unlocked(self, ctx: TenantContext, payroll_run_id: UUID | None) -> None:
        if payroll_run_id is None:
            return
        run = self._runs.get(ctx, payroll_run_id)
        if run is None:
            return
        if str(run.status).lower() in LOCKED_RUN_STATUSES:
            raise AppException("Payroll run is locked — cannot adjust leave")

    def _open_balance(self, ctx, company_id, employee_id, leave_type_id, year):
        matches = []
        for bal in self._balances.list_rows(ctx, company_id):
            if (
                bal.employee_id == employee_id
                and bal.leave_type_id == leave_type_id
                and bal.status == "open"
            ):
                matches.append(bal)
        for bal in matches:
            if bal.balance_year == year:
                return bal
        if matches:
            return max(matches, key=lambda b: int(b.balance_year or 0))
        return None

    @staticmethod
    def _can_mark_day(day: PlanDay) -> bool:
        if day.kind == "off":
            return False
        if (day.punch_status or "").lower() in PAID_STATUSES and day.kind == "skip":
            return False
        typed = (
            day.proposed_result == "adjusted"
            and leave_pool_rank(day.proposed_type_code or "") in (0, 1, 2)
        )
        if typed:
            return False
        return day.kind in {"candidate", "already_adjusted"}

    def _approved_leave_on(self, ctx, company_id, employee_id, on_date: date):
        for req in self._leave.list_rows(ctx, company_id):
            if req.employee_id != employee_id or req.status != LeaveRequestStatus.APPROVED.value:
                continue
            if req.start_date <= on_date <= req.end_date:
                return req
        return None

    def _build_context(
        self,
        ctx: TenantContext,
        employee_id: UUID,
        period_start: date,
        period_end: date,
        company_id: UUID | None,
    ) -> dict:
        if period_end < period_start:
            raise AppException("period_end must be on or after period_start")
        emp = self._master.get_employee(ctx, employee_id)
        if emp is None:
            raise NotFoundException("Employee not found")
        employment = self._employment.get_by_employee_id(ctx, employee_id)
        if employment is None:
            raise NotFoundException("Employment not found")
        cid = self._scope.resolve_company_id(ctx, company_id or employment.company_id)
        cache = self._days.build_cache(ctx, cid, period_start, period_end)
        scheduled = set(self._days._scheduled_dates(cache, employee_id))
        att_rows = [
            r
            for r in self._attendance.list_rows(ctx, cid, employee_id=employee_id)
            if period_start <= r.attendance_date <= period_end
        ]
        att_by_date = {r.attendance_date: r.attendance_status for r in att_rows}
        types = {t.id: t for t in self._types.list_rows(ctx, cid)}
        paid_leave_by_date: dict[date, tuple[UUID | None, str | None]] = {}
        for req in self._leave.list_rows(ctx, cid):
            if req.employee_id != employee_id or req.status != LeaveRequestStatus.APPROVED.value:
                continue
            lt = types.get(req.leave_type_id)
            if lt is None or not bool(lt.is_paid):
                continue
            for d in iter_dates_inclusive(req.start_date, req.end_date):
                if period_start <= d <= period_end:
                    paid_leave_by_date[d] = (req.leave_type_id, lt.leave_type_code)
        existing_events = {
            e.attendance_date: e
            for e in self._open_events(
                ctx,
                employee_id=employee_id,
                period_start=period_start,
                period_end=period_end,
                company_id=cid,
            )
        }
        year = leave_financial_year(period_start)
        pools: list[LeavePool] = []
        for lt in types.values():
            if str(lt.status).lower() != "active" or not bool(lt.is_paid):
                continue
            if leave_pool_rank(lt.leave_type_code) is None:
                continue
            bal = self._open_balance(ctx, cid, employee_id, lt.id, year)
            remaining = Decimal("0")
            if bal is not None:
                remaining = Decimal(str(bal.closing_balance or 0))
            pools.append(
                LeavePool(
                    leave_type_id=lt.id,
                    code=lt.leave_type_code,
                    name=lt.leave_type_name,
                    remaining=remaining,
                )
            )
        pools = ranked_paid_pools(pools)

        raw_days: list[PlanDay] = []
        for d in iter_dates_inclusive(period_start, period_end):
            is_hol = d in self._days._holiday_set(cache, employee_id)
            is_off = self._days._is_week_off(cache, employee_id, d)
            status = (att_by_date.get(d) or "").lower()
            event = existing_events.get(d)
            if is_hol or is_off:
                if status in ABSENT_STATUSES or status in HALF_STATUSES:
                    days_need = Decimal("0.5") if status in HALF_STATUSES else Decimal("1")
                    raw_days.append(
                        PlanDay(
                            attendance_date=d,
                            punch_status=status,
                            kind="candidate",
                            days=days_need,
                            proposed_result="lop",
                        )
                    )
                    continue
                raw_days.append(
                    PlanDay(
                        attendance_date=d,
                        punch_status="holiday" if is_hol else "week_off",
                        kind="off",
                        days=Decimal("0"),
                        proposed_result="skip",
                    )
                )
                continue
            if d not in scheduled:
                raw_days.append(
                    PlanDay(
                        attendance_date=d,
                        punch_status=status or "unscheduled",
                        kind="skip",
                        days=Decimal("0"),
                        proposed_result="skip",
                    )
                )
                continue
            if event is not None:
                lt = types.get(event.leave_type_id) if event.leave_type_id else None
                raw_days.append(
                    PlanDay(
                        attendance_date=d,
                        punch_status=status or event.result,
                        kind="already_adjusted",
                        days=Decimal(str(event.days)),
                        proposed_result=event.result,
                        proposed_type_code=lt.leave_type_code if lt else None,
                        proposed_type_id=event.leave_type_id,
                        already_adjusted=True,
                    )
                )
                continue
            if d in paid_leave_by_date:
                type_id, type_code = paid_leave_by_date[d]
                raw_days.append(
                    PlanDay(
                        attendance_date=d,
                        punch_status=status or "leave",
                        kind="already_adjusted",
                        days=Decimal("1"),
                        proposed_result="adjusted",
                        proposed_type_code=type_code,
                        proposed_type_id=type_id,
                        already_adjusted=True,
                    )
                )
                continue
            if status in PAID_STATUSES:
                raw_days.append(
                    PlanDay(
                        attendance_date=d,
                        punch_status=status,
                        kind="skip",
                        days=Decimal("0"),
                        proposed_result="skip",
                    )
                )
                continue
            days_need = Decimal("0.5") if status in HALF_STATUSES else Decimal("1")
            punch = status or "missing"
            raw_days.append(
                PlanDay(
                    attendance_date=d,
                    punch_status=punch,
                    kind="candidate",
                    days=days_need,
                    proposed_result="lop",
                )
            )

        candidates = [d for d in raw_days if d.kind == "candidate"]
        others = [d for d in raw_days if d.kind != "candidate"]
        planned_c, pools_after, used, lop = allocate_leave_days(candidates, pools)
        by_date = {d.attendance_date: d for d in others + planned_c}
        planned = [by_date[d] for d in iter_dates_inclusive(period_start, period_end)]

        return {
            "employee_id": employee_id,
            "company_id": cid,
            "employment": employment,
            "period_start": period_start,
            "period_end": period_end,
            "pools_before": pools,
            "pools_after": pools_after,
            "planned": planned,
            "days_to_use": used,
            "lop_leftover": lop,
        }

    def _serialize_preview(self, ctx_plan: dict) -> dict:
        def pool_dump(pools: list[LeavePool]) -> list[dict]:
            return [
                {
                    "leave_type_id": str(p.leave_type_id),
                    "code": canonical_leave_pool_code(p.code) or p.code,
                    "name": p.name,
                    "remaining": str(p.remaining),
                }
                for p in pools
            ]

        fy = leave_financial_year(ctx_plan["period_start"])
        days_out = []
        for d in ctx_plan["planned"]:
            days_out.append(
                {
                    "attendance_date": d.attendance_date.isoformat(),
                    "punch_status": d.punch_status,
                    "kind": d.kind,
                    "days": str(d.days),
                    "proposed_result": d.proposed_result,
                    "proposed_type_code": canonical_leave_pool_code(d.proposed_type_code or "")
                    or d.proposed_type_code,
                    "proposed_type_id": str(d.proposed_type_id) if d.proposed_type_id else None,
                    "already_adjusted": d.already_adjusted,
                    "can_mark_leave": self._can_mark_day(d),
                }
            )
        return {
            "employee_id": str(ctx_plan["employee_id"]),
            "period_start": ctx_plan["period_start"].isoformat(),
            "period_end": ctx_plan["period_end"].isoformat(),
            "financial_year": fy,
            "financial_year_label": leave_financial_year_label(fy),
            "balances": pool_dump(ctx_plan["pools_before"]),
            "balances_after": pool_dump(ctx_plan["pools_after"]),
            "days_to_use": str(ctx_plan["days_to_use"]),
            "lop_leftover": str(ctx_plan["lop_leftover"]),
            "days": days_out,
        }

    @staticmethod
    def _group_adjusted(days: list[PlanDay]) -> list[dict]:
        groups: list[dict] = []
        current: dict | None = None
        for day in sorted(days, key=lambda x: x.attendance_date):
            if day.proposed_result != "adjusted" or day.proposed_type_id is None:
                current = None
                continue
            if (
                current
                and current["leave_type_id"] == day.proposed_type_id
                and current["days_unit"] == day.days
                and (day.attendance_date - current["end"]).days == 1
            ):
                current["end"] = day.attendance_date
                current["days"] += Decimal(str(day.days))
                continue
            current = {
                "result": "adjusted",
                "leave_type_id": day.proposed_type_id,
                "start": day.attendance_date,
                "end": day.attendance_date,
                "days": Decimal(str(day.days)),
                "days_unit": day.days,
            }
            groups.append(current)
        return groups
