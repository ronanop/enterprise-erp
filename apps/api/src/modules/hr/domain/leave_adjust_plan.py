"""Pure leave-adjust planner: consume CL then SL then EL for absence days."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from uuid import UUID


def leave_pool_rank(code: str) -> int | None:
    key = (code or "").upper().replace(" ", "").replace("-", "").replace("_", "")
    if key in {"CL", "CASUAL", "CASUALLEAVE"}:
        return 0
    if key in {"SL", "SICK", "SICKLEAVE"}:
        return 1
    if key in {"EL", "EARNED", "EARNEDLEAVE", "PL", "PRIVILEGE", "PRIVILEGELEAVE"}:
        return 2
    return None


def canonical_leave_pool_code(code: str) -> str | None:
    rank = leave_pool_rank(code)
    if rank == 0:
        return "CL"
    if rank == 1:
        return "SL"
    if rank == 2:
        return "EL"
    return None


@dataclass
class LeavePool:
    leave_type_id: UUID
    code: str
    name: str
    remaining: Decimal


@dataclass
class PlanDay:
    attendance_date: date
    punch_status: str
    kind: str
    days: Decimal
    proposed_result: str
    proposed_type_code: str | None = None
    proposed_type_id: UUID | None = None
    already_adjusted: bool = False


@dataclass
class LeaveAdjustPlan:
    days: list[PlanDay]
    pools_before: list[LeavePool]
    pools_after: list[LeavePool]
    days_to_use: Decimal = Decimal("0")
    lop_leftover: Decimal = Decimal("0")


def allocate_leave_days(
    candidate_days: list[PlanDay],
    pools: list[LeavePool],
) -> tuple[list[PlanDay], list[LeavePool], Decimal, Decimal]:
    """Fill proposed_result on candidates. Returns (days, pools_after, used, lop)."""
    remaining = [
        LeavePool(
            leave_type_id=p.leave_type_id,
            code=p.code,
            name=p.name,
            remaining=Decimal(str(p.remaining)),
        )
        for p in sorted(
            pools, key=lambda x: leave_pool_rank(x.code) if leave_pool_rank(x.code) is not None else 99
        )
        if leave_pool_rank(p.code) is not None
    ]
    used = Decimal("0")
    lop = Decimal("0")
    out: list[PlanDay] = []
    for day in candidate_days:
        if day.kind != "candidate" or day.already_adjusted:
            out.append(day)
            continue
        need = Decimal(str(day.days))
        taken: LeavePool | None = None
        for pool in remaining:
            if pool.remaining >= need:
                taken = pool
                pool.remaining -= need
                break
        if taken is None:
            out.append(
                PlanDay(
                    attendance_date=day.attendance_date,
                    punch_status=day.punch_status,
                    kind=day.kind,
                    days=need,
                    proposed_result="lop",
                    already_adjusted=False,
                )
            )
            lop += need
            continue
        used += need
        out.append(
            PlanDay(
                attendance_date=day.attendance_date,
                punch_status=day.punch_status,
                kind=day.kind,
                days=need,
                proposed_result="adjusted",
                proposed_type_code=taken.code,
                proposed_type_id=taken.leave_type_id,
                already_adjusted=False,
            )
        )
    return out, remaining, used, lop


def ranked_paid_pools(pools: list[LeavePool]) -> list[LeavePool]:
    ranked = [p for p in pools if leave_pool_rank(p.code) is not None]
    ranked.sort(key=lambda p: leave_pool_rank(p.code) or 99)
    return ranked
