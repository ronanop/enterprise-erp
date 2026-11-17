"""Leave type / balance / request / adjustment services."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import HolidayCalendarStatus, HrEntityType, LeaveAdjustmentStatus, LeaveRequestStatus
from modules.hr.domain.exceptions import InvalidLeaveAdjustmentState
from modules.hr.domain.leave_accrual_calendar import leave_financial_year
from modules.hr.domain.leave_cycle_rules import (
    assert_leave_balance_for_cycle,
    assert_no_future_calendar_month_leave,
    validate_leave_cycle_application,
)
from modules.hr.models import HrLeaveBalance, HrLeaveRequest
from modules.hr.repository.holiday_calendar_repository import HolidayCalendarRepository
from modules.hr.repository.leave_adjustment_repository import LeaveAdjustmentRepository
from modules.hr.repository.leave_balance_repository import LeaveBalanceRepository
from modules.hr.repository.leave_request_repository import LeaveRequestRepository
from modules.hr.repository.leave_type_repository import LeaveTypeRepository
from modules.hr.service.document_number_service import DocumentNumberService
from modules.hr.service.engines import LeaveBalanceEngine, LeaveRequestEngine, LeaveTypeEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator


def _month_start(d: date) -> date:
    return date(d.year, d.month, 1)


def _assert_adjustment_month(adjustment_month: date) -> None:
    if adjustment_month.day != 1:
        raise AppException("adjustment_month must be the first day of a calendar month")
    if adjustment_month > _month_start(date.today()):
        raise AppException("Cannot create or approve leave adjustment for a future month")


def _holiday_dates_from_json(holidays_json) -> set[date]:
    out: set[date] = set()
    if not holidays_json:
        return out
    items = holidays_json if isinstance(holidays_json, list) else []
    if isinstance(holidays_json, dict):
        items = holidays_json.get("holidays") or holidays_json.get("dates") or []
        if not isinstance(items, list):
            items = []
    for item in items:
        raw = None
        if isinstance(item, str):
            raw = item
        elif isinstance(item, dict):
            raw = item.get("date") or item.get("holiday_date")
        if not raw:
            continue
        try:
            out.add(date.fromisoformat(str(raw)[:10]))
        except ValueError:
            continue
    return out


def _count_leave_days(
    start: date,
    end: date,
    non_working: set[date],
    *,
    sandwich: bool = False,
) -> Decimal:
    """Leave requests always count working days (exclude weekends + published holidays).

    ``sandwich`` is ignored here. Sandwich is an attendance LOP rule: weekly offs
    between leave or unauthorized absence become LOP (or leave) per company policy.
    """
    del sandwich
    count = 0
    cur = start
    while cur <= end:
        if cur not in non_working:
            count += 1
        cur += timedelta(days=1)
    return Decimal(count)


class LeaveTypeService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = LeaveTypeRepository(db)
        self._scope = HrScopeValidator(db)
        self._engine = LeaveTypeEngine()
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Leave type not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        branch_id = fields.get("branch_id")
        cid = self._scope.resolve_write_company_id(
            ctx, company_id or fields.pop("company_id", None), branch_id=branch_id
        )
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Leave type not found")
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> str:
        """Soft-delete when unused; otherwise deactivate so history stays intact."""
        self.get(ctx, row_id)

        used_total = self._db.scalar(
            select(func.coalesce(func.sum(HrLeaveBalance.used), 0)).where(
                HrLeaveBalance.leave_type_id == row_id,
                HrLeaveBalance.is_deleted.is_(False),
            )
        )
        referenced = Decimal(str(used_total or 0)) > 0

        if not referenced:
            any_requests = self._db.scalar(
                select(func.count())
                .select_from(HrLeaveRequest)
                .where(
                    HrLeaveRequest.leave_type_id == row_id,
                    HrLeaveRequest.is_deleted.is_(False),
                )
            )
            referenced = int(any_requests or 0) > 0

        if referenced:
            row = self._repo.update(ctx, row_id, status="inactive")
            if row is None:
                raise NotFoundException("Leave type not found")
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name="hr_leave_type",
                entity_id=row_id,
                operation="deactivate",
                performed_by=ctx.user_id,
            )
            return (
                "Leave type deactivated (still referenced by leave requests or used balances). "
                "It will no longer appear for new applications."
            )

        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Leave type not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_type",
            entity_id=row_id,
            operation="delete",
            performed_by=ctx.user_id,
        )
        return "Leave type deleted"


class LeaveBalanceService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = LeaveBalanceRepository(db)
        self._types = LeaveTypeRepository(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._engine = LeaveBalanceEngine()
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Leave balance not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, employee_id: UUID, company_id: UUID | None = None, **fields):
        """Create or revive/update existing balance for (company, employee, leave_type, year)."""
        cid = self._scope.resolve_write_company_id(ctx, company_id, branch_id=branch_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        opening = Decimal(str(fields.get("opening_balance", 0)))
        accrued = Decimal(str(fields.get("accrued", 0)))
        used = Decimal(str(fields.get("used", 0)))
        closing = opening + accrued - used
        fields = {**fields, "closing_balance": closing}
        leave_type_id = fields.get("leave_type_id")
        balance_year = fields.get("balance_year")
        if leave_type_id is not None and balance_year is not None:
            existing = self._repo.find_by_natural_key(
                ctx,
                company_id=cid,
                employee_id=employee_id,
                leave_type_id=leave_type_id,
                balance_year=int(balance_year),
                include_deleted=True,
            )
            if existing is not None:
                # Preserve used days on live rows (Assign UI may re-hit an existing unique key).
                keep_used = Decimal(str(existing.used or 0))
                if not getattr(existing, "is_deleted", False):
                    used = keep_used
                    closing = opening + accrued - used
                payload = {
                    "branch_id": branch_id,
                    "opening_balance": opening,
                    "accrued": accrued,
                    "used": used,
                    "closing_balance": closing,
                    "status": fields.get("status") or "open",
                }
                if getattr(existing, "is_deleted", False):
                    return self._repo.revive_and_update(ctx, existing, **payload)
                return self._repo.update(ctx, existing.id, **payload) or existing
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            **fields,
        )

    def import_rows(self, ctx: TenantContext, rows: list[dict]) -> dict:
        """Upsert leave balances from Excel/CSV rows (employee_code + leave_type_code)."""
        from modules.master_data.published import EmployeeRead

        created = 0
        updated = 0
        skipped = 0
        warnings: list[str] = []
        errors: list[str] = []
        results: list[dict] = []

        # Prefetch employees + leave types for tenant scope
        emp_rows = list(
            self._db.scalars(
                select(EmployeeRead).where(
                    EmployeeRead.tenant_id == ctx.tenant_id,
                    EmployeeRead.is_deleted.is_(False),
                )
            ).all()
        )
        emp_by_code: dict[str, object] = {}
        for emp in emp_rows:
            code = str(getattr(emp, "employee_code", "") or "").strip().upper()
            if code and code not in emp_by_code:
                emp_by_code[code] = emp

        type_cache: dict[UUID, dict[str, object]] = {}

        def types_for_company(company_id: UUID) -> dict[str, object]:
            if company_id not in type_cache:
                by_code: dict[str, object] = {}
                for lt in self._types.list_rows(ctx, company_id):
                    code = str(getattr(lt, "leave_type_code", "") or "").strip().upper()
                    if code:
                        by_code[code] = lt
                type_cache[company_id] = by_code
            return type_cache[company_id]

        def find_open_balance(company_id: UUID, employee_id: UUID, leave_type_id: UUID, year: int):
            for bal in self._repo.list_rows(ctx, company_id):
                if (
                    bal.employee_id == employee_id
                    and bal.leave_type_id == leave_type_id
                    and int(bal.balance_year) == year
                    and bal.status == "open"
                    and not getattr(bal, "is_deleted", False)
                ):
                    return bal
            return None

        for idx, raw in enumerate(rows, start=2):
            try:
                emp_code = str(raw.get("employee_code") or "").strip().upper()
                type_code = str(raw.get("leave_type_code") or "").strip().upper()
                if not emp_code or not type_code:
                    skipped += 1
                    errors.append(f"Row {idx}: employee_code and leave_type_code are required")
                    continue

                emp = emp_by_code.get(emp_code)
                if emp is None:
                    skipped += 1
                    errors.append(f"Row {idx}: employee '{emp_code}' not found")
                    continue

                company_id = getattr(emp, "company_id", None)
                branch_id = getattr(emp, "branch_id", None)
                if company_id is None or branch_id is None:
                    skipped += 1
                    errors.append(f"Row {idx}: employee '{emp_code}' has no company/branch")
                    continue

                lt = types_for_company(company_id).get(type_code)
                if lt is None:
                    skipped += 1
                    errors.append(
                        f"Row {idx}: leave type '{type_code}' not found for employee company"
                    )
                    continue

                year_raw = raw.get("balance_year")
                if year_raw is None or str(year_raw).strip() == "":
                    year = leave_financial_year(date.today())
                else:
                    year = int(year_raw)

                used = Decimal(str(raw.get("used") if raw.get("used") is not None else 0))
                accrued = Decimal(str(raw.get("accrued") if raw.get("accrued") is not None else 0))
                remaining = raw.get("remaining")
                opening_raw = raw.get("opening_balance")

                if remaining is not None and str(remaining).strip() != "":
                    # "Leaves left" from legacy sheet → employee app closing balance
                    remaining_dec = Decimal(str(remaining))
                    opening = remaining_dec + used - accrued
                elif opening_raw is not None and str(opening_raw).strip() != "":
                    opening = Decimal(str(opening_raw))
                else:
                    skipped += 1
                    errors.append(
                        f"Row {idx}: provide remaining (leaves left) or opening_balance"
                    )
                    continue

                closing = opening + accrued - used
                existing = find_open_balance(company_id, emp.id, lt.id, year)
                if existing is None:
                    row = self.create(
                        ctx,
                        branch_id=branch_id,
                        employee_id=emp.id,
                        company_id=company_id,
                        leave_type_id=lt.id,
                        balance_year=year,
                        opening_balance=opening,
                        accrued=accrued,
                        used=used,
                        status="open",
                    )
                    action = "created"
                    created += 1
                    balance_id = row.id
                    closing_out = row.closing_balance
                else:
                    row = self.update(
                        ctx,
                        existing.id,
                        opening_balance=opening,
                        accrued=accrued,
                        used=used,
                        status="open",
                    )
                    action = "updated"
                    updated += 1
                    balance_id = row.id
                    closing_out = row.closing_balance

                results.append(
                    {
                        "row": idx,
                        "employee_code": emp_code,
                        "leave_type_code": type_code,
                        "action": action,
                        "balance_id": str(balance_id),
                        "closing_balance": Decimal(str(closing_out if closing_out is not None else closing)),
                    }
                )
            except Exception as exc:  # noqa: BLE001 — collect per-row errors for import UX
                skipped += 1
                errors.append(f"Row {idx}: {exc}")

        self._db.flush()
        return {
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "warnings": warnings,
            "errors": errors,
            "results": results,
        }

    def credit_compoff(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        days: Decimal,
        company_id: UUID | None = None,
        reason: str | None = None,
        earned_date: date | None = None,
    ):
        """Ensure CO leave type + open balance for the year, then accrue days."""
        days_dec = Decimal(str(days))
        if days_dec <= 0:
            raise AppException("Comp off days must be positive")
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        earned = earned_date or date.today()

        co_type = None
        for lt in self._types.list_rows(ctx, cid):
            if str(getattr(lt, "leave_type_code", "")).upper() == "CO":
                co_type = lt
                break
        if co_type is None:
            co_type = LeaveTypeService(self._db).create(
                ctx,
                company_id=cid,
                leave_type_code="CO",
                leave_type_name="Comp Off",
                is_paid=True,
                max_days_per_year=Decimal("0"),
                status="active",
            )

        balance = None
        for bal in self._repo.list_rows(ctx, cid):
            if (
                bal.employee_id == employee_id
                and bal.leave_type_id == co_type.id
                and bal.balance_year == leave_financial_year(earned)
                and bal.status == "open"
            ):
                balance = bal
                break
        if balance is None:
            balance = self.create(
                ctx,
                branch_id=branch_id,
                employee_id=employee_id,
                company_id=cid,
                leave_type_id=co_type.id,
                balance_year=leave_financial_year(earned),
                opening_balance=Decimal("0"),
                accrued=Decimal("0"),
                used=Decimal("0"),
                status="open",
            )

        self._engine.accrue(balance, days_dec)
        updated = self._repo.update(
            ctx,
            balance.id,
            accrued=balance.accrued,
            used=balance.used,
            closing_balance=balance.closing_balance,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_balance",
            entity_id=balance.id,
            operation="compoff_credit",
            performed_by=ctx.user_id,
            new_value={"days": str(days_dec), "reason": reason, "earned_date": str(earned)},
        )
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=employee_id,
                template_code="hr.compoff_credit",
                template_name="Comp Off Credited",
                event_type="hr.compoff_credit",
                title="Comp off credited",
                body=f"{days_dec} Comp Off day(s) credited" + (f" - {reason}" if reason else "."),
                kind="leave",
            )
        except Exception:
            pass
        return updated or balance

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        opening = Decimal(str(fields.get("opening_balance", row.opening_balance or 0)))
        accrued = Decimal(str(fields.get("accrued", row.accrued or 0)))
        used = Decimal(str(fields.get("used", row.used or 0)))
        fields["closing_balance"] = opening + accrued - used
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Leave balance not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_balance",
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        row = self.get(ctx, row_id)
        used = Decimal(str(row.used or 0))
        if used > 0:
            raise AppException("Cannot remove leave type while used balance is greater than zero")
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Leave balance not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_balance",
            entity_id=row_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def apply_monthly_accrual_for_balance(
        self,
        ctx: TenantContext,
        balance,
        *,
        period_yyyymm: str,
        leave_type,
    ) -> Decimal:
        """Credit monthly_credit_days once per period; returns days credited (0 if skipped)."""
        if balance.status != "open":
            return Decimal("0")
        if getattr(balance, "last_accrual_yyyymm", None) == period_yyyymm:
            return Decimal("0")
        monthly = getattr(leave_type, "monthly_credit_days", None)
        if monthly is None:
            return Decimal("0")
        credit = Decimal(str(monthly))
        if credit <= 0:
            return Decimal("0")

        max_days = getattr(leave_type, "max_days_per_year", None)
        if max_days is not None:
            cap = Decimal(str(max_days))
            current_total = (
                Decimal(str(balance.opening_balance or 0)) + Decimal(str(balance.accrued or 0))
            )
            headroom = cap - current_total
            if headroom <= 0:
                self._repo.update(ctx, balance.id, last_accrual_yyyymm=period_yyyymm)
                return Decimal("0")
            credit = min(credit, headroom)

        self._engine.accrue(balance, credit)
        self._repo.update(
            ctx,
            balance.id,
            accrued=balance.accrued,
            closing_balance=balance.closing_balance,
            last_accrual_yyyymm=period_yyyymm,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_balance",
            entity_id=balance.id,
            operation=f"monthly_accrual_{period_yyyymm}",
            performed_by=ctx.user_id,
        )
        return credit

    def run_monthly_accrual_for_company(
        self,
        ctx: TenantContext,
        *,
        period_yyyymm: str,
        balance_year: int,
        company_id: UUID,
    ) -> dict:
        types = {t.id: t for t in self._types.list_rows(ctx, company_id)}
        credited_rows = 0
        total_days = Decimal("0")
        for bal in self._repo.list_rows(ctx, company_id):
            if bal.balance_year != balance_year or bal.status != "open":
                continue
            lt = types.get(bal.leave_type_id)
            if lt is None:
                continue
            days = self.apply_monthly_accrual_for_balance(
                ctx, bal, period_yyyymm=period_yyyymm, leave_type=lt
            )
            if days > 0:
                credited_rows += 1
                total_days += days
        return {
            "company_id": str(company_id),
            "credited_rows": credited_rows,
            "total_days": str(total_days),
        }

    @staticmethod
    def run_monthly_accrual_all_tenants(db: Session, *, period_yyyymm: str, balance_year: int) -> dict:
        """System task: accrue monthly credit for every open balance in the given year."""
        from uuid import uuid4

        from sqlalchemy import select

        from modules.foundation.domain.value_objects import TenantContext
        from modules.hr.models import HrLeaveBalance

        open_rows = list(
            db.scalars(
                select(HrLeaveBalance).where(
                    HrLeaveBalance.is_deleted.is_(False),
                    HrLeaveBalance.status == "open",
                    HrLeaveBalance.balance_year == balance_year,
                )
            ).all()
        )
        companies: set[tuple] = {(r.tenant_id, r.company_id) for r in open_rows}
        system_user = uuid4()
        total_credited = 0
        total_days = Decimal("0")
        svc = LeaveBalanceService(db)
        for tenant_id, company_id in companies:
            ctx = TenantContext(
                tenant_id=tenant_id,
                user_id=system_user,
                user_type="super_admin",
                company_id=company_id,
            )
            try:
                result = svc.run_monthly_accrual_for_company(
                    ctx,
                    period_yyyymm=period_yyyymm,
                    balance_year=balance_year,
                    company_id=company_id,
                )
                total_credited += int(result.get("credited_rows") or 0)
                total_days += Decimal(str(result.get("total_days") or "0"))
            except Exception:
                continue
        return {
            "status": "ok",
            "period": period_yyyymm,
            "balance_year": balance_year,
            "credited_rows": total_credited,
            "total_days": str(total_days),
            "companies": len(companies),
        }

    def carry_forward_year_end(
        self,
        ctx: TenantContext,
        *,
        from_year: int | None = None,
        company_id: UUID | None = None,
        default_max_days: Decimal | float = Decimal("5"),
    ) -> dict:
        """Close source-year balances and open next-year openings for CF-enabled types."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        src_year = int(from_year or (date.today().year - 1))
        to_year = src_year + 1
        default_cap = Decimal(str(default_max_days))

        types = {t.id: t for t in self._types.list_rows(ctx, cid)}
        balances = [
            b
            for b in self._repo.list_rows(ctx, cid)
            if b.balance_year == src_year and b.status == "open"
        ]

        items: list[dict] = []
        carried = 0
        closed = 0

        for bal in balances:
            lt = types.get(bal.leave_type_id)
            unused = Decimal(str(bal.closing_balance or 0))
            if unused <= 0:
                unused = (
                    Decimal(str(bal.opening_balance or 0))
                    + Decimal(str(bal.accrued or 0))
                    - Decimal(str(bal.used or 0))
                )
            carry_allowed = bool(getattr(lt, "carry_forward_allowed", False)) if lt else False
            max_days = getattr(lt, "max_carry_forward_days", None) if lt else None
            cap = Decimal(str(max_days)) if max_days is not None else default_cap
            carry_days = min(unused, cap) if carry_allowed and unused > 0 else Decimal("0")

            if carry_days > 0:
                next_bal = None
                for cand in self._repo.list_rows(ctx, cid):
                    if (
                        cand.employee_id == bal.employee_id
                        and cand.leave_type_id == bal.leave_type_id
                        and cand.balance_year == to_year
                        and cand.status == "open"
                    ):
                        next_bal = cand
                        break
                if next_bal is None:
                    next_bal = self.create(
                        ctx,
                        company_id=cid,
                        branch_id=bal.branch_id,
                        employee_id=bal.employee_id,
                        leave_type_id=bal.leave_type_id,
                        balance_year=to_year,
                        opening_balance=carry_days,
                        accrued=Decimal("0"),
                        used=Decimal("0"),
                        status="open",
                    )
                else:
                    new_opening = Decimal(str(next_bal.opening_balance or 0)) + carry_days
                    self._repo.update(
                        ctx,
                        next_bal.id,
                        opening_balance=new_opening,
                        closing_balance=(
                            new_opening
                            + Decimal(str(next_bal.accrued or 0))
                            - Decimal(str(next_bal.used or 0))
                        ),
                    )
                carried += 1
                items.append(
                    {
                        "employee_id": bal.employee_id,
                        "leave_type_id": bal.leave_type_id,
                        "unused_days": unused,
                        "carried_days": carry_days,
                        "next_balance_id": next_bal.id if next_bal else None,
                    }
                )

            self._repo.update(
                ctx,
                bal.id,
                closing_balance=unused,
                status="closed",
            )
            closed += 1

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_balance",
            entity_id=cid,
            operation="carry_forward_year_end",
            performed_by=ctx.user_id,
            new_value={"from_year": src_year, "to_year": to_year, "carried": carried, "closed": closed},
        )
        return {
            "from_year": src_year,
            "to_year": to_year,
            "carried": carried,
            "closed": closed,
            "items": items,
        }


class LeaveRequestService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = LeaveRequestRepository(db)
        self._balances = LeaveBalanceRepository(db)
        self._types = LeaveTypeRepository(db)
        self._holidays = HolidayCalendarRepository(db)
        self._scope = HrScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = LeaveRequestEngine()
        self._balance_engine = LeaveBalanceEngine()
        self._master = HrMasterDataAdapter(db)
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Leave request not found")
        return row

    def _load_non_working_dates(self, ctx: TenantContext, company_id: UUID, start: date, end: date) -> set[date]:
        """Weekly-off policy (or Sat/Sun default) + published holidays."""
        from modules.hr.repository.weekly_off_policy_repository import WeeklyOffPolicyRepository
        from modules.hr.service.engines.calendar_rules import expand_non_working_dates

        years = {start.year, end.year}
        calendars = self._holidays.list_rows(ctx, company_id)
        holiday_dates: set[date] = set()
        for cal in calendars:
            if cal.status != HolidayCalendarStatus.PUBLISHED.value:
                continue
            if cal.calendar_year not in years:
                continue
            if cal.holidays_json:
                holiday_dates |= _holiday_dates_from_json(cal.holidays_json)

        policy = WeeklyOffPolicyRepository(self._db).get_default(ctx, company_id)
        rules = policy.rules_json if policy else None
        custom = policy.custom_weekdays_json if policy else None
        alt_start = policy.alternate_saturday_start if policy else None
        return expand_non_working_dates(
            start,
            end,
            rules=rules,
            custom_weekdays=custom,
            alternate_start=alt_start,
            holiday_dates=holiday_dates,
        )

    def _apply_sandwich_days(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        leave_type_id: UUID,
        start_date: date,
        end_date: date,
    ) -> Decimal:
        leave_type = self._types.get(ctx, leave_type_id)
        if leave_type is None:
            raise NotFoundException("Leave type not found")
        if end_date < start_date:
            raise AppException("end_date must be on or after start_date")
        non_working = self._load_non_working_dates(ctx, company_id, start_date, end_date)
        return _count_leave_days(start_date, end_date, non_working)

    def _find_open_balance(self, ctx: TenantContext, company_id: UUID, employee_id: UUID, leave_type_id: UUID, year: int):
        for bal in self._balances.list_rows(ctx, company_id):
            if (
                bal.employee_id == employee_id
                and bal.leave_type_id == leave_type_id
                and bal.balance_year == year
                and bal.status == "open"
            ):
                return bal
        return None

    def _company_sandwich_enabled(self, ctx: TenantContext, company_id: UUID) -> bool:
        for leave_type in self._types.list_rows(ctx, company_id):
            if str(getattr(leave_type, "status", "")).lower() != "active":
                continue
            if bool(getattr(leave_type, "sandwich_rule_enabled", False)):
                return True
        from modules.hr.service.sandwich_attendance_service import resolve_company_sandwich_settings

        return bool(resolve_company_sandwich_settings(self._db, company_id).get("enabled"))

    def _refresh_attendance_sandwich(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        employee_id: UUID,
        branch_id: UUID | None,
        around_start: date,
        around_end: date,
    ) -> None:
        """Re-evaluate sandwich LOP after leave approval (approved leave → sandwich off)."""
        if not self._company_sandwich_enabled(ctx, company_id):
            return
        from modules.hr.service.sandwich_attendance_service import (
            apply_sandwich_for_employee,
            resolve_company_sandwich_settings,
        )

        settings = resolve_company_sandwich_settings(self._db, company_id)

        window_start = around_start - timedelta(days=10)
        window_end = around_end + timedelta(days=10)
        non_working = self._load_non_working_dates(ctx, company_id, window_start, window_end)
        holiday_dates: set[date] = set()
        years = {window_start.year, window_end.year}
        for cal in self._holidays.list_rows(ctx, company_id):
            if cal.status != HolidayCalendarStatus.PUBLISHED.value:
                continue
            if cal.calendar_year not in years:
                continue
            if cal.holidays_json:
                holiday_dates |= _holiday_dates_from_json(cal.holidays_json)
        apply_sandwich_for_employee(
            self._db,
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            employee_id=employee_id,
            window_start=window_start,
            window_end=window_end,
            as_of=date.today(),
            is_non_working=lambda d: d in non_working,
            holiday_dates=holiday_dates,
            trigger=settings["trigger"],
            off_becomes=settings["off_becomes"],
        )

    def _validate_cycle_for_request(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        employee_id: UUID,
        leave_type_id: UUID,
        start_date: date,
        end_date: date,
        days_count,
        require_balance: bool = True,
    ) -> None:
        leave_type = self._types.get(ctx, leave_type_id)
        balance = self._find_open_balance(
            ctx, company_id, employee_id, leave_type_id, leave_financial_year(start_date)
        )
        validate_leave_cycle_application(
            start_date=start_date,
            end_date=end_date,
            days_count=days_count,
            closing_balance=None if balance is None else balance.closing_balance,
            last_accrual_yyyymm=getattr(balance, "last_accrual_yyyymm", None) if balance else None,
            monthly_credit_days=getattr(leave_type, "monthly_credit_days", None) if leave_type else None,
            require_balance=require_balance,
        )

    def create(self, ctx: TenantContext, *, branch_id: UUID, employee_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        start_date = fields["start_date"]
        end_date = fields["end_date"]
        leave_type_id = fields["leave_type_id"]
        leave_type = self._types.get(ctx, leave_type_id)
        if leave_type is None:
            raise NotFoundException("Leave type not found")
        if str(getattr(leave_type, "status", "")).lower() != "active":
            raise AppException("Cannot apply leave against an inactive leave type")
        fields["days_count"] = self._apply_sandwich_days(
            ctx,
            company_id=cid,
            leave_type_id=leave_type_id,
            start_date=start_date,
            end_date=end_date,
        )
        # Leave cycle: calendar months only (past/current). Posted balance only - no early credit.
        assert_no_future_calendar_month_leave(start_date, end_date)
        balance = self._find_open_balance(
            ctx, cid, employee_id, leave_type_id, leave_financial_year(start_date)
        )
        if balance is not None:
            leave_type = self._types.get(ctx, leave_type_id)
            assert_leave_balance_for_cycle(
                days_count=fields["days_count"],
                closing_balance=balance.closing_balance,
                start_date=start_date,
                end_date=end_date,
                last_accrual_yyyymm=getattr(balance, "last_accrual_yyyymm", None),
                monthly_credit_days=getattr(leave_type, "monthly_credit_days", None) if leave_type else None,
            )
        doc = self._numbers.generate(HrEntityType.LEAVE_REQUEST, cid, HrLeaveRequest, "document_number")
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            document_number=doc,
            status=fields.pop("status", LeaveRequestStatus.DRAFT.value),
            **fields,
        )

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validate_cycle_for_request(
            ctx,
            company_id=row.company_id,
            employee_id=row.employee_id,
            leave_type_id=row.leave_type_id,
            start_date=row.start_date,
            end_date=row.end_date,
            days_count=row.days_count,
            require_balance=True,
        )
        self._engine.submit(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        try:
            from modules.hr.service.hr_notify import notify_employee, notify_users_with_permission
            from modules.master_data.published import EmployeeRead

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.leave_submitted",
                template_name="Leave Request Submitted",
                event_type="hr.leave_submitted",
                title="Leave request submitted",
                body=f"Leave request {row.document_number} was submitted and is pending approval.",
                kind="leave",
                extra={"href": "/hr/ess", "leave_request_id": str(row.id)},
            )
            exclude: set[UUID] = set()
            if ctx.user_id:
                exclude.add(ctx.user_id)
            emp = self._db.get(EmployeeRead, row.employee_id)
            if emp is not None:
                if emp.user_id:
                    exclude.add(emp.user_id)
                if emp.reporting_manager_id:
                    mgr = self._db.get(EmployeeRead, emp.reporting_manager_id)
                    if mgr is not None and mgr.user_id:
                        exclude.add(mgr.user_id)
            notify_users_with_permission(
                self._db,
                tenant_id=ctx.tenant_id,
                permission_code="hr.leave:approve",
                template_code="hr.leave_submitted",
                template_name="Leave Request Submitted",
                event_type="hr.leave_submitted",
                title="Leave Pending",
                body=f"Leave request {row.document_number} needs approval.",
                kind="leave",
                extra={"href": "/hr/ess-inbox", "leave_request_id": str(row.id)},
                exclude_user_ids=exclude,
            )
        except Exception:
            pass
        return updated

    def manager_approve(self, ctx: TenantContext, row_id: UUID, *, approver_employee_id: UUID | None = None):
        row = self.get(ctx, row_id)
        self._engine.manager_approve(row)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            manager_approver_id=approver_employee_id,
            approver_employee_id=approver_employee_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_request",
            entity_id=row_id,
            operation="manager_approve",
            performed_by=ctx.user_id,
        )
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.leave_manager_approved",
                template_name="Leave Manager Approved",
                event_type="hr.leave_manager_approved",
                title="Leave approved by manager",
                body=f"Leave request {row.document_number} was approved by your manager and is pending HR.",
                kind="leave",
                cc_reporting_manager=False,
            )
        except Exception:
            pass
        return updated

    def approve(self, ctx: TenantContext, row_id: UUID, *, approver_employee_id: UUID | None = None):
        row = self.get(ctx, row_id)
        self._validate_cycle_for_request(
            ctx,
            company_id=row.company_id,
            employee_id=row.employee_id,
            leave_type_id=row.leave_type_id,
            start_date=row.start_date,
            end_date=row.end_date,
            days_count=row.days_count,
            require_balance=True,
        )
        self._engine.approve(row)
        balance = self._find_open_balance(
            ctx, row.company_id, row.employee_id, row.leave_type_id, leave_financial_year(row.start_date)
        )
        if balance is None:
            raise NotFoundException("Open leave balance not found for approval year")
        self._balance_engine.apply_usage(balance, row.days_count)
        self._balances.update(
            ctx,
            balance.id,
            used=balance.used,
            closing_balance=balance.closing_balance,
        )
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            hr_approver_id=approver_employee_id,
            approver_employee_id=approver_employee_id,
            decided_at=datetime.now(timezone.utc),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_request",
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
                template_code="hr.leave_approved",
                template_name="Leave Approved",
                event_type="hr.leave_approved",
                title="Leave approved",
                body=f"Your leave request {row.document_number} has been approved.",
                kind="leave",
                cc_reporting_manager=False,
            )
        except Exception:
            pass
        try:
            self._refresh_attendance_sandwich(
                ctx,
                company_id=row.company_id,
                employee_id=row.employee_id,
                branch_id=row.branch_id,
                around_start=row.start_date,
                around_end=row.end_date,
            )
        except Exception:
            pass
        return updated

    def reject(self, ctx: TenantContext, row_id: UUID, *, approver_employee_id: UUID | None = None):
        row = self.get(ctx, row_id)
        self._engine.reject(row)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            approver_employee_id=approver_employee_id,
            decided_at=datetime.now(timezone.utc),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_request",
            entity_id=row_id,
            operation="reject",
            performed_by=ctx.user_id,
        )
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.leave_rejected",
                template_name="Leave Rejected",
                event_type="hr.leave_rejected",
                title="Leave rejected",
                body=f"Your leave request {row.document_number} was rejected.",
                kind="leave",
                cc_reporting_manager=False,
            )
        except Exception:
            pass
        return updated

    def cancel(self, ctx: TenantContext, row_id: UUID, *, employee_id: UUID | None = None):
        row = self.get(ctx, row_id)
        if employee_id is not None and row.employee_id != employee_id:
            raise NotFoundException("Leave request not found")
        self._engine.cancel(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_request",
            entity_id=row_id,
            operation="cancel",
            performed_by=ctx.user_id,
        )
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.leave_cancelled",
                template_name="Leave Request Cancelled",
                event_type="hr.leave_cancelled",
                title="Leave request cancelled",
                body=f"Leave request {row.document_number} was cancelled.",
                kind="leave",
            )
        except Exception:
            pass
        return updated


class LeaveAdjustmentService:
    def __init__(self, db: Session) -> None:
        self._repo = LeaveAdjustmentRepository(db)
        self._balances = LeaveBalanceRepository(db)
        self._types = LeaveTypeRepository(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._balance_engine = LeaveBalanceEngine()
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Leave adjustment not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        leave_type_id: UUID,
        adjustment_month: date,
        days_delta: Decimal,
        company_id: UUID | None = None,
        reason: str | None = None,
        status: str | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        if self._types.get(ctx, leave_type_id) is None:
            raise NotFoundException("Leave type not found")
        _assert_adjustment_month(adjustment_month)
        st = status or LeaveAdjustmentStatus.DRAFT.value
        if st not in {s.value for s in LeaveAdjustmentStatus}:
            raise AppException(f"Invalid leave adjustment status '{st}'")
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            adjustment_month=adjustment_month,
            days_delta=Decimal(str(days_delta)),
            reason=reason,
            status=st,
        )

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        _assert_adjustment_month(row.adjustment_month)
        if row.status != LeaveAdjustmentStatus.DRAFT.value:
            raise InvalidLeaveAdjustmentState("Only draft leave adjustments can be submitted")
        return self._repo.update(ctx, row_id, status=LeaveAdjustmentStatus.SUBMITTED.value)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        _assert_adjustment_month(row.adjustment_month)
        if row.status != LeaveAdjustmentStatus.SUBMITTED.value:
            raise InvalidLeaveAdjustmentState("Only submitted leave adjustments can be approved")
        balance = None
        for bal in self._balances.list_rows(ctx, row.company_id):
            if (
                bal.employee_id == row.employee_id
                and bal.leave_type_id == row.leave_type_id
                and bal.balance_year == leave_financial_year(row.adjustment_month)
                and bal.status == "open"
            ):
                balance = bal
                break
        if balance is None:
            raise NotFoundException("Open leave balance not found for adjustment year")
        self._balance_engine.apply_adjustment(balance, row.days_delta)
        self._balances.update(
            ctx,
            balance.id,
            accrued=balance.accrued,
            used=balance.used,
            closing_balance=balance.closing_balance,
        )
        updated = self._repo.update(
            ctx,
            row_id,
            status=LeaveAdjustmentStatus.APPROVED.value,
            approved_by=ctx.user_id,
            decided_at=datetime.now(timezone.utc),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_adjustment",
            entity_id=row_id,
            operation="approve",
            performed_by=ctx.user_id,
        )
        return updated

    def create_and_apply(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        leave_type_id: UUID,
        adjustment_month: date,
        days_delta: Decimal,
        company_id: UUID | None = None,
        reason: str | None = None,
    ):
        """HR shortcut: create a submitted adjustment and approve immediately."""
        row = self.create(
            ctx,
            branch_id=branch_id,
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            adjustment_month=adjustment_month,
            days_delta=days_delta,
            company_id=company_id,
            reason=reason,
            status=LeaveAdjustmentStatus.SUBMITTED.value,
        )
        return self.approve(ctx, row.id)

    def reject(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status != LeaveAdjustmentStatus.SUBMITTED.value:
            raise InvalidLeaveAdjustmentState("Only submitted leave adjustments can be rejected")
        updated = self._repo.update(
            ctx,
            row_id,
            status=LeaveAdjustmentStatus.REJECTED.value,
            approved_by=ctx.user_id,
            decided_at=datetime.now(timezone.utc),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_leave_adjustment",
            entity_id=row_id,
            operation="reject",
            performed_by=ctx.user_id,
        )
        return updated
