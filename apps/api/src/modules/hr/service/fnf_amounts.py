"""FNF leave encashment and gratuity helpers."""

from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.hr.models import HrLeaveBalance, HrLeaveType
from modules.hr.service.engines.leave_balance_engine import LeaveBalanceEngine

_Q = Decimal("0.0001")
_BASIC_RATE = Decimal("0.40")
_STANDARD_DAYS = Decimal("30")


def _money(value: Decimal) -> Decimal:
    return value.quantize(_Q, rounding=ROUND_HALF_UP)


def daily_rate_from_gross(gross: Decimal) -> Decimal:
    basic = _money(Decimal(str(gross or 0)) * _BASIC_RATE)
    return _money(basic / _STANDARD_DAYS)


def basic_from_gross(gross: Decimal) -> Decimal:
    return _money(Decimal(str(gross or 0)) * _BASIC_RATE)


def compute_gratuity(
    *,
    date_of_joining: date | None,
    last_working_date: date | None,
    basic: Decimal,
) -> tuple[Decimal, int]:
    """Payment of Gratuity Act style: (15/26)*basic*completed_years if years >= 5."""
    if date_of_joining is None or last_working_date is None:
        return Decimal("0"), 0
    if last_working_date < date_of_joining:
        return Decimal("0"), 0
    years = (last_working_date - date_of_joining).days // 365
    if years < 5:
        return Decimal("0"), years
    amount = _money((Decimal("15") / Decimal("26")) * Decimal(str(basic or 0)) * Decimal(years))
    return amount, years


def compute_leave_encashment(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    employee_id: UUID,
    daily_rate: Decimal,
    apply_usage: bool = True,
) -> tuple[Decimal, Decimal, list[dict]]:
    """Sum encashable closing balances * daily_rate; optionally debit balances."""
    types = {
        t.id: t
        for t in db.scalars(
            select(HrLeaveType).where(
                HrLeaveType.tenant_id == tenant_id,
                HrLeaveType.company_id == company_id,
                HrLeaveType.is_deleted.is_(False),
                HrLeaveType.encashment_allowed.is_(True),
            )
        ).all()
    }
    balances = list(
        db.scalars(
            select(HrLeaveBalance).where(
                HrLeaveBalance.tenant_id == tenant_id,
                HrLeaveBalance.company_id == company_id,
                HrLeaveBalance.employee_id == employee_id,
                HrLeaveBalance.is_deleted.is_(False),
                HrLeaveBalance.status == "open",
            )
        ).all()
    )
    engine = LeaveBalanceEngine()
    total_days = Decimal("0")
    total_amount = Decimal("0")
    details: list[dict] = []
    for bal in balances:
        lt = types.get(bal.leave_type_id)
        if lt is None:
            continue
        days = Decimal(str(bal.closing_balance or 0))
        if days <= 0:
            continue
        amount = _money(days * Decimal(str(daily_rate or 0)))
        total_days += days
        total_amount += amount
        details.append(
            {
                "leave_type_id": str(lt.id),
                "leave_type_code": lt.leave_type_code,
                "days": str(days),
                "amount": str(amount),
            }
        )
        if apply_usage:
            engine.apply_usage(bal, days)
    return total_days, _money(total_amount), details
