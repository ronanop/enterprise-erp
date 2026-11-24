"""Load / cache HRMS employee profiles for Organization → Users."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.models.hrms_user_profile import HrmsUserProfile
from modules.foundation.models.security import SecUser
from modules.foundation.service.hrms_integration_settings_service import (
    HrmsIntegrationSettingsService,
)
from modules.master_data.models.employee import MasterEmployee


def _s(value: Any, limit: int | None = None) -> str:
    text = "" if value is None else str(value).strip()
    if limit is not None:
        return text[:limit]
    return text


def _date_str(value: Any) -> str | None:
    if value is None or value == "":
        return None
    return str(value).strip()[:20] or None


def _f(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


@dataclass(frozen=True)
class HrmsLeaveBalanceRow:
    leave_type_code: str
    leave_type_name: str
    opening_balance: float
    accrued: float
    used: float
    closing_balance: float
    year: int | None


@dataclass(frozen=True)
class HrmsUserProfileView:
    user_id: UUID
    employee_id: UUID | None
    employee_code: str
    display_name: str
    first_name: str
    last_name: str
    email: str
    mobile: str
    designation: str
    department: str
    manager: str
    manager_code: str
    branch: str
    company: str
    status: str
    date_of_joining: str | None
    date_of_leaving: str | None
    gender: str | None
    date_of_birth: str | None
    employment_type: str | None
    work_location: str | None
    is_manager: bool
    leave_balances: list[HrmsLeaveBalanceRow]
    leave_balance_total: float
    leave_used_total: float
    profile_fetched_at: datetime | None
    leave_fetched_at: datetime | None
    leave_refreshed: bool


class HrmsUserProfileService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._remote = HrmsIntegrationSettingsService(db)

    def get_for_user(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        actor_user_id: UUID | None,
        force_refresh: bool = False,
    ) -> HrmsUserProfileView:
        user = self._require_user(tenant_id, user_id)
        employee = self._employee_for_user(tenant_id, user)
        code = (employee.employee_code if employee else None) or self._code_from_cache(tenant_id, user_id)
        if not code:
            raise AppException("This user is not linked to an HRMS employee code")

        row = self._get_row(tenant_id, user_id)
        if force_refresh or row is None:
            remote_id, data = self._remote.find_employee_by_code(tenant_id, code)
            if data is None:
                if row is None:
                    raise NotFoundException(f"Employee {code} not found on remote HRMS")
                # Keep saved profile; still try leave from stale cache if remote miss.
                leave_refreshed = False
            else:
                row = self._upsert_row(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    employee_id=employee.id if employee else None,
                    remote_id=remote_id,
                    data=data,
                    actor_user_id=actor_user_id,
                    update_leave=True,
                )
                leave_refreshed = True
        else:
            # Always refresh leave balances from remote.
            remote_id, data = self._remote.find_employee_by_code(tenant_id, code)
            if data is None:
                leave_refreshed = False
            else:
                self._apply_leave(row, data, actor_user_id=actor_user_id)
                if remote_id and not row.remote_id:
                    row.remote_id = remote_id
                leave_refreshed = True
                self._db.flush()

        assert row is not None
        return self._to_view(row, leave_refreshed=leave_refreshed)

    def upsert_from_remote_row(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        employee_id: UUID | None,
        remote_id: str | None,
        data: dict[str, Any],
        actor_user_id: UUID | None,
    ) -> None:
        self._upsert_row(
            tenant_id=tenant_id,
            user_id=user_id,
            employee_id=employee_id,
            remote_id=remote_id,
            data=data,
            actor_user_id=actor_user_id,
            update_leave=True,
        )

    def _require_user(self, tenant_id: UUID, user_id: UUID) -> SecUser:
        user = self._db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant_id,
                SecUser.id == user_id,
                SecUser.is_deleted.is_(False),
            )
        )
        if user is None:
            raise NotFoundException("User not found")
        return user

    def _employee_for_user(self, tenant_id: UUID, user: SecUser) -> MasterEmployee | None:
        if user.employee_id is not None:
            emp = self._db.get(MasterEmployee, user.employee_id)
            if emp is not None and emp.tenant_id == tenant_id and not emp.is_deleted:
                return emp
        return self._db.scalar(
            select(MasterEmployee)
            .where(
                MasterEmployee.tenant_id == tenant_id,
                MasterEmployee.user_id == user.id,
                MasterEmployee.is_deleted.is_(False),
            )
            .order_by(MasterEmployee.created_at.asc())
            .limit(1)
        )

    def _code_from_cache(self, tenant_id: UUID, user_id: UUID) -> str | None:
        row = self._get_row(tenant_id, user_id)
        return (row.employee_code if row else None) or None

    def _get_row(self, tenant_id: UUID, user_id: UUID) -> HrmsUserProfile | None:
        return self._db.scalar(
            select(HrmsUserProfile).where(
                HrmsUserProfile.tenant_id == tenant_id,
                HrmsUserProfile.user_id == user_id,
                HrmsUserProfile.is_deleted.is_(False),
            )
        )

    def _upsert_row(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        employee_id: UUID | None,
        remote_id: str | None,
        data: dict[str, Any],
        actor_user_id: UUID | None,
        update_leave: bool,
    ) -> HrmsUserProfile:
        row = self._get_row(tenant_id, user_id)
        now = datetime.now(timezone.utc)
        code = _s(data.get("employee_code"), 50)
        first = _s(data.get("first_name"), 100)
        last = _s(data.get("last_name"), 100)
        name = _s(data.get("name"), 200) or f"{first} {last}".strip()
        if row is None:
            row = HrmsUserProfile(
                tenant_id=tenant_id,
                user_id=user_id,
                employee_code=code or "UNKNOWN",
                created_by=actor_user_id,
            )
            self._db.add(row)

        row.is_deleted = False
        row.deleted_at = None
        row.deleted_by = None
        row.employee_id = employee_id
        row.remote_id = remote_id or row.remote_id
        row.employee_code = code or row.employee_code
        row.display_name = name
        row.first_name = first
        row.last_name = last
        row.email = _s(data.get("email"), 255).lower()
        row.mobile = _s(data.get("mobile"), 30)
        row.designation = _s(data.get("designation"), 100)
        row.department = _s(data.get("department"), 150)
        row.manager = _s(data.get("manager"), 200)
        row.manager_code = _s(data.get("manager_code"), 50)
        row.branch = _s(data.get("branch"), 150)
        row.company = _s(data.get("company"), 200)
        row.status = _s(data.get("status"), 30).lower() or "active"
        row.date_of_joining = _date_str(data.get("date_of_joining"))
        row.date_of_leaving = _date_str(data.get("date_of_leaving"))
        row.gender = _s(data.get("gender"), 30) or None
        row.date_of_birth = _date_str(data.get("date_of_birth"))
        row.employment_type = _s(data.get("employment_type"), 50) or None
        row.work_location = _s(data.get("work_location"), 150) or None
        row.is_manager = bool(data.get("is_manager"))
        row.raw_json = data
        row.profile_fetched_at = now
        row.updated_by = actor_user_id
        row.version = int(row.version or 1) + 1
        if update_leave:
            self._apply_leave(row, data, actor_user_id=actor_user_id, now=now)
        self._db.flush()
        return row

    def _apply_leave(
        self,
        row: HrmsUserProfile,
        data: dict[str, Any],
        *,
        actor_user_id: UUID | None,
        now: datetime | None = None,
    ) -> None:
        balances = data.get("leave_balances")
        row.leave_balances = balances if isinstance(balances, list) else []
        row.leave_balance_total = _f(data.get("leave_balance_total"))
        row.leave_used_total = _f(data.get("leave_used_total"))
        row.leave_fetched_at = now or datetime.now(timezone.utc)
        if actor_user_id:
            row.updated_by = actor_user_id
        row.version = int(row.version or 1) + 1

    def _to_view(self, row: HrmsUserProfile, *, leave_refreshed: bool) -> HrmsUserProfileView:
        balances: list[HrmsLeaveBalanceRow] = []
        raw = row.leave_balances if isinstance(row.leave_balances, list) else []
        for item in raw:
            if not isinstance(item, dict):
                continue
            year_raw = item.get("year")
            try:
                year = int(year_raw) if year_raw is not None else None
            except (TypeError, ValueError):
                year = None
            balances.append(
                HrmsLeaveBalanceRow(
                    leave_type_code=_s(item.get("leave_type_code"), 50),
                    leave_type_name=_s(item.get("leave_type_name"), 100),
                    opening_balance=_f(item.get("opening_balance")),
                    accrued=_f(item.get("accrued")),
                    used=_f(item.get("used")),
                    closing_balance=_f(item.get("closing_balance")),
                    year=year,
                )
            )
        return HrmsUserProfileView(
            user_id=row.user_id,
            employee_id=row.employee_id,
            employee_code=row.employee_code,
            display_name=row.display_name,
            first_name=row.first_name,
            last_name=row.last_name,
            email=row.email,
            mobile=row.mobile,
            designation=row.designation,
            department=row.department,
            manager=row.manager,
            manager_code=row.manager_code,
            branch=row.branch,
            company=row.company,
            status=row.status,
            date_of_joining=row.date_of_joining,
            date_of_leaving=row.date_of_leaving,
            gender=row.gender,
            date_of_birth=row.date_of_birth,
            employment_type=row.employment_type,
            work_location=row.work_location,
            is_manager=bool(row.is_manager),
            leave_balances=balances,
            leave_balance_total=float(row.leave_balance_total or 0),
            leave_used_total=float(row.leave_used_total or 0),
            profile_fetched_at=row.profile_fetched_at,
            leave_fetched_at=row.leave_fetched_at,
            leave_refreshed=leave_refreshed,
        )
