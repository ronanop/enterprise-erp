"""Tenant settings + remote fetch for HRMS integration employee API."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any
from uuid import UUID
from urllib.parse import urljoin, urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException
from modules.foundation.service.hrms_user_sync_service import HrmsUserSyncResult, HrmsUserSyncService
from modules.foundation.service.setting_service import SettingService
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.published import EmployeeCommands
from modules.organization.models.branch import OrgBranch
from modules.organization.models.company import OrgCompany
from modules.organization.models.hierarchy import OrgDepartment
from modules.platform.encryption import decrypt_field, mask_field
from security.field_crypto import pii_lookup

KEY_BASE_URL = "hrms.integration.base_url"
KEY_API_KEY = "hrms.integration.api_key"
KEY_EMPLOYEES_PATH = "hrms.integration.employees_path"
KEY_PAGE_SIZE = "hrms.integration.page_size"

DEFAULT_BASE_URL = "http://172.16.110.15:3000"
DEFAULT_EMPLOYEES_PATH = "/api/v1/hr/integration/employees"
DEFAULT_PAGE_SIZE = 100


@dataclass(frozen=True)
class HrmsIntegrationSettingsView:
    base_url: str
    employees_path: str
    page_size: int
    has_api_key: bool
    api_key_masked: str
    api_key: str


@dataclass(frozen=True)
class HrmsIntegrationTestResult:
    ok: bool
    status_code: int
    total: int
    sample_count: int
    message: str
    sample: list[dict[str, Any]]


@dataclass(frozen=True)
class HrmsIntegrationSyncResult:
    fetched: int
    employees_created: int
    employees_updated: int
    employees_skipped: int
    user_sync: HrmsUserSyncResult


def _parse_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _normalize_base_url(raw: str) -> str:
    value = (raw or "").strip().rstrip("/")
    if not value:
        raise AppException("Base URL is required")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise AppException("Base URL must be an absolute http(s) URL")
    return value


def _normalize_path(raw: str) -> str:
    value = (raw or DEFAULT_EMPLOYEES_PATH).strip() or DEFAULT_EMPLOYEES_PATH
    if not value.startswith("/"):
        value = f"/{value}"
    return value


class HrmsIntegrationSettingsService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._settings = SettingService(db)
        self._employees = EmployeeCommands(db)

    def get(self, tenant_id: UUID) -> HrmsIntegrationSettingsView:
        base = self._raw(tenant_id, KEY_BASE_URL) or DEFAULT_BASE_URL
        path = self._raw(tenant_id, KEY_EMPLOYEES_PATH) or DEFAULT_EMPLOYEES_PATH
        page_size_raw = self._raw(tenant_id, KEY_PAGE_SIZE) or str(DEFAULT_PAGE_SIZE)
        try:
            page_size = max(1, min(500, int(page_size_raw)))
        except ValueError:
            page_size = DEFAULT_PAGE_SIZE
        api_key = self._api_key(tenant_id)
        return HrmsIntegrationSettingsView(
            base_url=base,
            employees_path=path,
            page_size=page_size,
            has_api_key=bool(api_key),
            api_key_masked=mask_field(api_key) if api_key else "",
            api_key=api_key or "",
        )

    def save(
        self,
        *,
        tenant_id: UUID,
        actor_id: UUID | None,
        base_url: str,
        employees_path: str,
        page_size: int,
        api_key: str | None,
    ) -> HrmsIntegrationSettingsView:
        base = _normalize_base_url(base_url)
        path = _normalize_path(employees_path)
        size = max(1, min(500, int(page_size or DEFAULT_PAGE_SIZE)))

        self._settings.upsert_setting(
            tenant_id=tenant_id,
            setting_key=KEY_BASE_URL,
            setting_value=base,
            updated_by=actor_id,
        )
        self._settings.upsert_setting(
            tenant_id=tenant_id,
            setting_key=KEY_EMPLOYEES_PATH,
            setting_value=path,
            updated_by=actor_id,
        )
        self._settings.upsert_setting(
            tenant_id=tenant_id,
            setting_key=KEY_PAGE_SIZE,
            setting_value=str(size),
            updated_by=actor_id,
        )
        key = (api_key or "").strip()
        if key:
            self._settings.upsert_setting(
                tenant_id=tenant_id,
                setting_key=KEY_API_KEY,
                setting_value=key,
                updated_by=actor_id,
                is_encrypted=True,
            )
        elif not self._api_key(tenant_id):
            raise AppException("API key is required")

        return self.get(tenant_id)

    def test(self, tenant_id: UUID) -> HrmsIntegrationTestResult:
        rows, total, status = self._fetch_page(tenant_id, page=1)
        sample = []
        for row in rows[:5]:
            data = row.get("data") if isinstance(row, dict) else None
            if not isinstance(data, dict):
                continue
            sample.append(
                {
                    "employee_code": data.get("employee_code"),
                    "name": data.get("name"),
                    "email": data.get("email"),
                    "department": data.get("department"),
                    "status": data.get("status"),
                }
            )
        return HrmsIntegrationTestResult(
            ok=status == 200,
            status_code=status,
            total=total,
            sample_count=len(sample),
            message="Connected" if status == 200 else f"Remote returned HTTP {status}",
            sample=sample,
        )

    def sync(self, *, tenant_id: UUID, actor_user_id: UUID | None) -> HrmsIntegrationSyncResult:
        remote_rows = self._fetch_all(tenant_id)
        company_id, branch_id, department_id = self._default_org_scope(tenant_id)
        created = updated = skipped = 0

        for row in remote_rows:
            data = row.get("data") if isinstance(row, dict) else None
            if not isinstance(data, dict):
                skipped += 1
                continue
            code = str(data.get("employee_code") or "").strip()
            if not code:
                skipped += 1
                continue
            result = self._upsert_employee(
                tenant_id=tenant_id,
                company_id=company_id,
                branch_id=branch_id,
                department_id=department_id,
                data=data,
                actor_user_id=actor_user_id,
            )
            if result == "created":
                created += 1
            elif result == "updated":
                updated += 1
            else:
                skipped += 1

        user_sync = HrmsUserSyncService(self._db).sync(
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
        )
        self._cache_profiles_from_remote(
            tenant_id=tenant_id,
            company_id=company_id,
            remote_rows=remote_rows,
            actor_user_id=actor_user_id,
        )
        return HrmsIntegrationSyncResult(
            fetched=len(remote_rows),
            employees_created=created,
            employees_updated=updated,
            employees_skipped=skipped,
            user_sync=user_sync,
        )

    def find_employee_by_code(
        self, tenant_id: UUID, employee_code: str
    ) -> tuple[str | None, dict[str, Any] | None]:
        """Scan remote pages for one employee_code. Returns (remote_id, data)."""
        target = (employee_code or "").strip().lower()
        if not target:
            return None, None
        page_size = 500
        first, total, _ = self._fetch_page_with_size(tenant_id, page=1, page_size=page_size)
        pages = max(1, (total + page_size - 1) // page_size)

        def _match(rows: list[dict[str, Any]]) -> tuple[str | None, dict[str, Any] | None]:
            for row in rows:
                data = row.get("data") if isinstance(row, dict) else None
                if not isinstance(data, dict):
                    continue
                code = str(data.get("employee_code") or "").strip().lower()
                if code == target:
                    remote_id = str(row.get("id") or "").strip() or None
                    return remote_id, data
            return None, None

        hit = _match(first)
        if hit[1] is not None:
            return hit
        for page in range(2, pages + 1):
            page_rows, _, _ = self._fetch_page_with_size(tenant_id, page=page, page_size=page_size)
            hit = _match(page_rows)
            if hit[1] is not None:
                return hit
        return None, None

    def _fetch_page_with_size(
        self, tenant_id: UUID, *, page: int, page_size: int
    ) -> tuple[list[dict[str, Any]], int, int]:
        base_url, path, _, api_key = self._require_config(tenant_id)
        url = self._employees_url(base_url, path)
        try:
            with httpx.Client(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
                response = client.get(
                    url,
                    headers={"X-HRMS-Api-Key": api_key},
                    params={"page": page, "page_size": page_size},
                )
        except httpx.ConnectTimeout as exc:
            raise AppException(
                "Cannot reach HRMS API (connection timeout). Check host/VPN."
            ) from exc
        except httpx.TimeoutException as exc:
            raise AppException("HRMS API request timed out") from exc
        except httpx.HTTPError as exc:
            raise AppException(f"HRMS API request failed: {exc}") from exc
        if response.status_code == 401:
            raise AppException("HRMS API key was rejected (401)")
        if response.status_code >= 400:
            raise AppException(f"HRMS API error HTTP {response.status_code}")
        payload = response.json()
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise AppException("Unexpected HRMS API response shape")
        rows = data.get("rows") or data.get("items") or []
        if not isinstance(rows, list):
            rows = []
        total = int(data.get("total") or len(rows))
        return [r for r in rows if isinstance(r, dict)], total, response.status_code

    def _cache_profiles_from_remote(
        self,
        *,
        tenant_id: UUID,
        company_id: UUID,
        remote_rows: list[dict[str, Any]],
        actor_user_id: UUID | None,
    ) -> None:
        from modules.foundation.service.hrms_user_profile_service import HrmsUserProfileService

        profiles = HrmsUserProfileService(self._db)
        for row in remote_rows:
            data = row.get("data") if isinstance(row, dict) else None
            if not isinstance(data, dict):
                continue
            code = str(data.get("employee_code") or "").strip()
            if not code:
                continue
            emp = self._db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.tenant_id == tenant_id,
                    MasterEmployee.company_id == company_id,
                    MasterEmployee.employee_code == code,
                    MasterEmployee.is_deleted.is_(False),
                )
            )
            if emp is None or emp.user_id is None:
                continue
            remote_id = str(row.get("id") or "").strip() or None
            profiles.upsert_from_remote_row(
                tenant_id=tenant_id,
                user_id=emp.user_id,
                employee_id=emp.id,
                remote_id=remote_id,
                data=data,
                actor_user_id=actor_user_id,
            )

    def _raw(self, tenant_id: UUID, key: str) -> str | None:
        row = self._settings._repo.get_by_key(tenant_id, key)
        if row is None:
            return None
        return (row.setting_value or "").strip() or None

    def _api_key(self, tenant_id: UUID) -> str | None:
        raw = self._raw(tenant_id, KEY_API_KEY)
        if not raw:
            return None
        return (decrypt_field(raw) or raw).strip() or None

    def _require_config(self, tenant_id: UUID) -> tuple[str, str, int, str]:
        view = self.get(tenant_id)
        api_key = self._api_key(tenant_id)
        if not api_key:
            raise AppException("Configure the HRMS API key first")
        return view.base_url, view.employees_path, view.page_size, api_key

    def _employees_url(self, base_url: str, path: str) -> str:
        return urljoin(f"{base_url}/", path.lstrip("/"))

    def _fetch_page(self, tenant_id: UUID, *, page: int) -> tuple[list[dict[str, Any]], int, int]:
        base_url, path, page_size, api_key = self._require_config(tenant_id)
        url = self._employees_url(base_url, path)
        try:
            with httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
                response = client.get(
                    url,
                    params={"page": page, "page_size": page_size},
                    headers={
                        "Accept": "application/json",
                        "X-HRMS-Api-Key": api_key,
                    },
                )
        except httpx.ConnectTimeout as exc:
            raise AppException(
                f"HRMS host timed out ({base_url}). Confirm the other machine is on, "
                f"the app is running on port 3000, and this PC can reach that IP."
            ) from exc
        except httpx.ConnectError as exc:
            raise AppException(
                f"Cannot connect to HRMS at {base_url}. Check the base URL / network / firewall."
            ) from exc
        except httpx.HTTPError as exc:
            raise AppException(f"Could not reach HRMS API: {exc}") from exc

        if response.status_code == 401:
            raise AppException("HRMS API key was rejected (401)")
        if response.status_code >= 400:
            raise AppException(f"HRMS API error HTTP {response.status_code}")

        payload = response.json()
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise AppException("Unexpected HRMS API response shape")
        rows = data.get("rows") or data.get("items") or []
        if not isinstance(rows, list):
            rows = []
        total = int(data.get("total") or len(rows))
        return [r for r in rows if isinstance(r, dict)], total, response.status_code

    def _fetch_all(self, tenant_id: UUID) -> list[dict[str, Any]]:
        first, total, _ = self._fetch_page(tenant_id, page=1)
        view = self.get(tenant_id)
        page_size = view.page_size
        all_rows = list(first)
        pages = max(1, (total + page_size - 1) // page_size)
        for page in range(2, pages + 1):
            rows, _, _ = self._fetch_page(tenant_id, page=page)
            all_rows.extend(rows)
        return all_rows

    def _default_org_scope(self, tenant_id: UUID) -> tuple[UUID, UUID, UUID]:
        company = self._db.scalar(
            select(OrgCompany)
            .where(OrgCompany.tenant_id == tenant_id, OrgCompany.is_deleted.is_(False))
            .order_by(OrgCompany.created_at.asc())
            .limit(1)
        )
        if company is None:
            raise AppException("Create a company before syncing HRMS employees")
        branch = self._db.scalar(
            select(OrgBranch)
            .where(
                OrgBranch.tenant_id == tenant_id,
                OrgBranch.company_id == company.id,
                OrgBranch.is_deleted.is_(False),
            )
            .order_by(OrgBranch.created_at.asc())
            .limit(1)
        )
        if branch is None:
            raise AppException("Create a branch before syncing HRMS employees")
        department = self._db.scalar(
            select(OrgDepartment)
            .where(
                OrgDepartment.tenant_id == tenant_id,
                OrgDepartment.branch_id == branch.id,
                OrgDepartment.is_deleted.is_(False),
            )
            .order_by(OrgDepartment.created_at.asc())
            .limit(1)
        )
        if department is None:
            # Fall back to any department in the company.
            department = self._db.scalar(
                select(OrgDepartment)
                .where(
                    OrgDepartment.tenant_id == tenant_id,
                    OrgDepartment.company_id == company.id,
                    OrgDepartment.is_deleted.is_(False),
                )
                .order_by(OrgDepartment.created_at.asc())
                .limit(1)
            )
        if department is None:
            raise AppException("Create a department before syncing HRMS employees")
        return company.id, branch.id, department.id

    def _apply_employee_fields(
        self,
        row: MasterEmployee,
        *,
        code: str,
        email: str,
        first: str,
        last: str,
        mobile: str,
        designation: str,
        status: str,
        doj: date,
        dol: date | None,
        is_manager: bool,
        actor_user_id: UUID | None,
        company_id: UUID,
        branch_id: UUID,
        department_id: UUID,
    ) -> None:
        """Restore + update a master employee row (including previously soft-deleted)."""
        row.is_deleted = False
        row.deleted_at = None
        row.deleted_by = None
        row.employee_code = code[:50]
        row.first_name = first[:100]
        row.last_name = last[:100]
        row.email = email[:255]
        row.mobile = mobile[:30]
        row.designation = designation[:100]
        row.status = status
        row.date_of_joining = doj
        row.date_of_leaving = dol
        row.is_manager = is_manager
        row.company_id = company_id
        row.branch_id = branch_id
        row.department_id = department_id
        if actor_user_id:
            row.updated_by = actor_user_id
        row.version = int(row.version or 1) + 1

    def _upsert_employee(
        self,
        *,
        tenant_id: UUID,
        company_id: UUID,
        branch_id: UUID,
        department_id: UUID,
        data: dict[str, Any],
        actor_user_id: UUID | None,
    ) -> str:
        code = str(data.get("employee_code") or "").strip()
        email = str(data.get("email") or "").strip().lower()
        if not email or "@" not in email:
            email = f"{code.lower()}@hr-login.local"
        first = str(data.get("first_name") or "").strip()
        last = str(data.get("last_name") or "").strip()
        if not first and data.get("name"):
            parts = str(data.get("name")).strip().split()
            first = parts[0] if parts else code
            last = " ".join(parts[1:]) if len(parts) > 1 else "."
        first = first or code
        last = last or "."
        mobile = str(data.get("mobile") or "0000000000").strip() or "0000000000"
        designation = str(data.get("designation") or "Employee").strip() or "Employee"
        status = str(data.get("status") or "active").strip().lower() or "active"
        if status not in {
            "draft",
            "onboarding",
            "active",
            "probation",
            "on_leave",
            "notice_period",
            "resigned",
            "terminated",
            "ex_employee",
        }:
            status = "active"
        doj = _parse_date(data.get("date_of_joining")) or date.today()
        dol = _parse_date(data.get("date_of_leaving"))
        is_manager = bool(data.get("is_manager"))
        fields = dict(
            code=code,
            email=email,
            first=first,
            last=last,
            mobile=mobile,
            designation=designation,
            status=status,
            doj=doj,
            dol=dol,
            is_manager=is_manager,
            actor_user_id=actor_user_id,
            company_id=company_id,
            branch_id=branch_id,
            department_id=department_id,
        )

        # Match by code first (live or soft-deleted — unique includes deleted rows).
        existing = self._db.scalar(
            select(MasterEmployee)
            .where(
                MasterEmployee.tenant_id == tenant_id,
                MasterEmployee.company_id == company_id,
                MasterEmployee.employee_code == code,
            )
            .order_by(MasterEmployee.is_deleted.asc(), MasterEmployee.created_at.asc())
            .limit(1)
        )
        # Also match renamed soft-deleted codes: CODE-DEL-xxxxxxxx
        if existing is None:
            existing = self._db.scalar(
                select(MasterEmployee)
                .where(
                    MasterEmployee.tenant_id == tenant_id,
                    MasterEmployee.company_id == company_id,
                    MasterEmployee.employee_code.like(f"{code}-DEL-%"),
                )
                .order_by(MasterEmployee.created_at.desc())
                .limit(1)
            )
        if existing is not None:
            was_deleted = bool(existing.is_deleted)
            self._apply_employee_fields(existing, **fields)
            self._db.flush()
            return "created" if was_deleted else "updated"

        # Match by email_lookup across live + soft-deleted (unique includes deleted).
        email_key = pii_lookup(email)
        if email_key:
            by_email = self._db.scalar(
                select(MasterEmployee)
                .where(
                    MasterEmployee.tenant_id == tenant_id,
                    MasterEmployee.company_id == company_id,
                    MasterEmployee.email_lookup == email_key,
                )
                .order_by(MasterEmployee.is_deleted.asc(), MasterEmployee.created_at.asc())
                .limit(1)
            )
            if by_email is not None:
                was_deleted = bool(by_email.is_deleted)
                self._apply_employee_fields(by_email, **fields)
                self._db.flush()
                return "created" if was_deleted else "updated"

        # If this email is already used by another live employee with a different code,
        # fall back to a code-based login email to avoid unique collisions in one sync.
        if email_key:
            clash = self._db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.tenant_id == tenant_id,
                    MasterEmployee.company_id == company_id,
                    MasterEmployee.email_lookup == email_key,
                    MasterEmployee.is_deleted.is_(False),
                    MasterEmployee.employee_code != code,
                )
            )
            if clash is not None:
                fields["email"] = f"{code.lower()}@hr-login.local"

        self._employees.create_system_employee(
            created_by=actor_user_id,
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            department_id=department_id,
            employee_code=code[:50],
            first_name=first[:100],
            last_name=last[:100],
            email=fields["email"][:255],
            mobile=mobile[:30],
            designation=designation[:100],
            date_of_joining=doj,
            date_of_leaving=dol,
            status=status,
            is_manager=is_manager,
        )
        return "created"
