"""Bulk employee Excel/CSV import — upsert by employee code (no duplicates)."""

from __future__ import annotations

import re
from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.org_data_scope import has_module_wide_data_access
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models import HrDesignationAssignment, HrEmployment
from modules.hr.service.assignment_service import DesignationAssignmentService
from modules.hr.service.designation_service import DesignationService
from modules.hr.service.employment_service import EmploymentService
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.service.employee_service import EmployeeService
from modules.organization.models.branch import OrgBranch
from modules.organization.models.company import OrgCompany
from modules.organization.models.hierarchy import OrgLocation
from modules.organization.service.branch_service import BranchService
from modules.organization.service.company_service import CompanyService
from modules.organization.service.hierarchy_service import DepartmentService, LocationService

# Excel Entity / Organisation → canonical key
ENTITY_ALIASES: dict[str, str] = {
    "digitech": "digitech",
    "digi tech": "digitech",
    "cache digitech": "digitech",
    "cachedigitech": "digitech",
    "cdpl": "digitech",
    "technology": "technology",
    "technologies": "technology",
    "cache technology": "technology",
    "cache technologies": "technology",
    "cache technologies & infotech": "technology",
    "cachetech": "technology",
    "ctpl": "technology",
    "cts": "technology",
}

# Ensure these two operating companies exist for Cache Excel uploads
ENTITY_COMPANY_SPECS: dict[str, dict[str, str]] = {
    "digitech": {
        "company_code": "DEMOCO",
        "alt_codes": "CACHEDIG",
        "company_name": "Cache Digitech",
        "legal_name": "Cache Digitech",
        "branch_code": "HQ",
        "branch_name": "Head Office",
        "city": "Bengaluru",
    },
    "technology": {
        "company_code": "CACHETECH",
        "alt_codes": "",
        "company_name": "Cache Technologies & Infotech",
        "legal_name": "Cache Technologies & Infotech",
        "branch_code": "GK",
        "branch_name": "Greater Kailash",
        "city": "New Delhi",
    },
}


def _norm(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _code_slug(value: str, prefix: str, max_len: int = 40) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", (value or "").strip().upper()).strip("-")
    if not slug:
        slug = "X"
    return f"{prefix}-{slug}"[:max_len]


def _split_name(full: str) -> tuple[str, str]:
    parts = [p for p in (full or "").strip().split() if p]
    if not parts:
        return "Unknown", "Employee"
    if len(parts) == 1:
        return parts[0], "."
    return parts[0], " ".join(parts[1:])


def _parse_date(raw: str | None) -> date:
    text = (raw or "").strip()
    if not text:
        return date.today()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return date.today()


def _entity_key(raw: str | None) -> str | None:
    n = _norm(raw)
    if not n:
        return None
    if n in ENTITY_ALIASES:
        return ENTITY_ALIASES[n]
    if "digitech" in n or "digi tech" in n:
        return "digitech"
    if "technolog" in n:
        return "technology"
    return None


def _infer_entity_key(entity_raw: str, org_raw: str, emp_code: str) -> str | None:
    """Map Excel Entity/Organisation (+ emp code hints) → digitech | technology."""
    # Combined: Organisation=Cache + Entity=Technologies → "cache technologies"
    combined = " ".join(p for p in (_norm(org_raw), _norm(entity_raw)) if p).strip()
    for candidate in (entity_raw, org_raw, combined):
        key = _entity_key(candidate)
        if key:
            return key

    code = (emp_code or "").strip().upper()
    if code.startswith("CDPL"):
        return "digitech"
    if code.startswith("CTS") or code.startswith("CT"):
        return "technology"
    if code.startswith("GBP"):
        return "technology"
    return None


class EmployeeImportService:
    """Import workforce rows: get-or-create masters, upsert employees by code."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._employees = EmployeeService(db)
        self._companies = CompanyService(db)
        self._branches = BranchService(db)
        self._departments = DepartmentService(db)
        self._locations = LocationService(db)
        self._designations = DesignationService(db)
        self._desig_asg = DesignationAssignmentService(db)
        self._employment = EmploymentService(db)

    def clear_all_employees(self, ctx: TenantContext) -> dict:
        """Soft-delete employees and liberate unique codes/emails for re-import."""
        from datetime import datetime, timezone

        stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        stmt = select(MasterEmployee).where(
            MasterEmployee.tenant_id == ctx.tenant_id,
            MasterEmployee.is_deleted.is_(False),
        )
        if ctx.company_id and not has_module_wide_data_access(ctx, "hr"):
            stmt = stmt.where(MasterEmployee.company_id == ctx.company_id)

        rows = list(self._db.scalars(stmt).all())
        deleted = 0
        for i, row in enumerate(rows):
            row.is_deleted = True
            row.deleted_at = datetime.now(timezone.utc)
            row.deleted_by = ctx.user_id
            # Free unique (company_id, employee_code) and (company_id, email)
            freed_code = f"{row.employee_code}-DEL-{stamp}-{i}"
            row.employee_code = freed_code[:50]
            row.email = f"deleted-{row.id.hex[:12]}-{stamp}@cleared.local"[:255]
            deleted += 1

        self._db.flush()
        return {
            "deleted": deleted,
            "message": f"Soft-deleted {deleted} employee(s). Codes freed for re-import.",
        }

    def import_rows(self, ctx: TenantContext, rows: list[dict]) -> dict:
        # Make sure Digitech + Technologies companies (and HQ branches) are active
        self._ensure_entity_companies(ctx)
        companies = self._companies.list_companies(ctx)
        if not companies:
            return {
                "created": 0,
                "updated": 0,
                "skipped": len(rows),
                "warnings": ["No companies found for this tenant."],
                "errors": ["Cannot import without a company."],
                "results": [],
            }

        company_by_key = self._index_companies(companies)
        default_company = company_by_key.get("digitech") or companies[0]

        dept_cache: dict[tuple[UUID, str], UUID] = {}
        desig_cache: dict[tuple[UUID, str], UUID] = {}
        loc_cache: dict[tuple[UUID, str], tuple[UUID, str]] = {}
        branch_by_company: dict[UUID, UUID] = {}

        created = 0
        updated = 0
        skipped = 0
        warnings: list[str] = []
        errors: list[str] = []
        results: list[dict] = []
        code_to_id: dict[str, UUID] = {}

        for c in companies:
            for emp in self._employees.list_employees(ctx, company_id=c.id):
                code_to_id[emp.employee_code.strip().upper()] = emp.id

        pending_managers: list[tuple[UUID, str, str]] = []

        for idx, raw in enumerate(rows, start=2):
            try:
                emp_code = str(raw.get("employee_code") or "").strip().upper()
                name = str(raw.get("name") or "").strip()
                if not emp_code:
                    skipped += 1
                    errors.append(f"Row {idx}: missing Emp Code")
                    continue
                if not name:
                    skipped += 1
                    errors.append(f"Row {idx}: missing Name")
                    continue

                entity_raw = str(raw.get("entity") or "").strip()
                org_raw = str(raw.get("organisation") or raw.get("organization") or "").strip()
                company = self._resolve_company(
                    entity_raw,
                    org_raw,
                    emp_code,
                    company_by_key,
                    companies,
                    default_company,
                    warnings,
                    idx,
                )
                branch_id = self._default_branch(ctx, company.id, branch_by_company)
                first_name, last_name = _split_name(name)

                department_name = str(raw.get("department") or "General").strip() or "General"
                designation_name = str(raw.get("designation") or "Staff").strip() or "Staff"
                base_location = str(raw.get("base_location") or "").strip()
                manager_raw = str(raw.get("reporting_manager") or "").strip()
                email = str(raw.get("email") or "").strip()
                mobile = str(raw.get("mobile") or "").strip() or "0000000000"
                joining = _parse_date(str(raw.get("joining_date") or ""))

                if not email:
                    email = f"{emp_code.lower().replace(' ', '')}@import.cache.local"

                dept_id = self._ensure_department(
                    ctx, company.id, branch_id, department_name, dept_cache
                )
                designation_id = self._ensure_designation(
                    ctx, company.id, designation_name, desig_cache
                )
                work_location: str | None = None
                if base_location:
                    _loc_id, work_location = self._ensure_location(
                        ctx, company.id, branch_id, base_location, loc_cache
                    )

                # Upsert by Emp Code across all companies (re-import remaps Digitech↔Technologies)
                existing = self._find_by_code_any(ctx, emp_code)
                if existing:
                    next_email = email
                    if (
                        "@import.cache.local" in email
                        and existing.email
                        and "@import.cache.local" not in str(existing.email)
                    ):
                        next_email = existing.email

                    # Move company if Entity changed since last import
                    if existing.company_id != company.id:
                        row = self._db.get(MasterEmployee, existing.id)
                        if row is not None:
                            row.company_id = company.id
                            row.branch_id = branch_id
                            self._db.flush()

                    self._employees.update_employee(
                        ctx,
                        existing.id,
                        branch_id=branch_id,
                        department_id=dept_id,
                        first_name=first_name,
                        last_name=last_name,
                        email=next_email,
                        mobile=mobile if mobile != "0000000000" else existing.mobile,
                        designation=designation_name,
                        date_of_joining=joining,
                        status="active",
                    )
                    emp_id = existing.id
                    self._upsert_employment(
                        ctx,
                        company_id=company.id,
                        branch_id=branch_id,
                        employee_id=emp_id,
                        joining=joining,
                        work_location=work_location,
                    )
                    updated += 1
                    action = "updated"
                else:
                    created_emp = self._employees.create_employee(
                        ctx,
                        company_id=company.id,
                        branch_id=branch_id,
                        department_id=dept_id,
                        employee_code=emp_code,
                        first_name=first_name,
                        last_name=last_name,
                        email=email,
                        mobile=mobile,
                        designation=designation_name,
                        date_of_joining=joining,
                        bypass_onboarding=True,
                        status="active",
                    )
                    emp_id = created_emp.id
                    self._upsert_employment(
                        ctx,
                        company_id=company.id,
                        branch_id=branch_id,
                        employee_id=emp_id,
                        joining=joining,
                        work_location=work_location,
                    )
                    created += 1
                    action = "created"

                self._ensure_designation_assignment(
                    ctx,
                    company_id=company.id,
                    branch_id=branch_id,
                    employee_id=emp_id,
                    designation_id=designation_id,
                    joining=joining,
                )

                code_to_id[emp_code] = emp_id
                if manager_raw:
                    pending_managers.append((emp_id, emp_code, manager_raw))

                results.append(
                    {
                        "row": idx,
                        "employee_code": emp_code,
                        "action": action,
                        "employee_id": str(emp_id),
                        "company": company.company_name,
                        "entity": entity_raw or org_raw or company.company_name,
                        "base_location": work_location or "",
                        "designation": designation_name,
                    }
                )
            except Exception as exc:  # noqa: BLE001 — collect row errors
                skipped += 1
                errors.append(f"Row {idx}: {exc}")

        for emp_id, emp_code, manager_raw in pending_managers:
            mgr_id = self._resolve_manager(manager_raw, code_to_id)
            if not mgr_id:
                warnings.append(
                    f"{emp_code}: reporting manager '{manager_raw}' not found — left blank"
                )
                continue
            if mgr_id == emp_id:
                warnings.append(f"{emp_code}: cannot be own reporting manager")
                continue
            try:
                self._employees.update_employee(
                    ctx,
                    emp_id,
                    reporting_manager_id=mgr_id,
                )
            except Exception as exc:  # noqa: BLE001
                warnings.append(f"{emp_code}: manager link failed — {exc}")

        self._db.flush()
        return {
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "warnings": warnings[:200],
            "errors": errors[:200],
            "results": results,
        }

    def _ensure_entity_companies(self, ctx: TenantContext) -> None:
        """Undelete/create Cache Digitech + Cache Technologies so Entity column can map."""
        for key, spec in ENTITY_COMPANY_SPECS.items():
            codes = [spec["company_code"]] + [
                c for c in (spec.get("alt_codes") or "").split(",") if c.strip()
            ]
            company = None
            for code in codes:
                company = self._db.scalar(
                    select(OrgCompany).where(
                        OrgCompany.tenant_id == ctx.tenant_id,
                        OrgCompany.company_code == code.strip(),
                    )
                )
                if company is not None:
                    break

            if company is None:
                company = OrgCompany(
                    id=uuid4(),
                    tenant_id=ctx.tenant_id,
                    company_code=spec["company_code"],
                    company_name=spec["company_name"],
                    legal_name=spec["legal_name"],
                    country_code="IN",
                    currency_code="INR",
                    fiscal_year_start_month=4,
                    timezone="Asia/Kolkata",
                    status="active",
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                )
                self._db.add(company)
                self._db.flush()
            else:
                company.is_deleted = False
                company.deleted_at = None
                company.deleted_by = None
                company.status = "active"
                company.company_name = spec["company_name"]
                company.legal_name = spec["legal_name"]
                company.updated_by = ctx.user_id
                self._db.flush()

            branch = self._db.scalar(
                select(OrgBranch).where(
                    OrgBranch.tenant_id == ctx.tenant_id,
                    OrgBranch.company_id == company.id,
                    OrgBranch.branch_code == spec["branch_code"],
                )
            )
            if branch is None:
                # reuse any existing branch for company
                branch = self._db.scalar(
                    select(OrgBranch).where(
                        OrgBranch.tenant_id == ctx.tenant_id,
                        OrgBranch.company_id == company.id,
                    )
                )
            if branch is None:
                branch = OrgBranch(
                    id=uuid4(),
                    tenant_id=ctx.tenant_id,
                    company_id=company.id,
                    branch_code=spec["branch_code"],
                    branch_name=spec["branch_name"],
                    branch_type="head_office" if key == "digitech" else "regional",
                    city=spec["city"],
                    country_code="IN",
                    status="active",
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                )
                self._db.add(branch)
            else:
                branch.is_deleted = False
                branch.deleted_at = None
                branch.deleted_by = None
                branch.status = "active"
                branch.updated_by = ctx.user_id
            self._db.flush()

    def _find_by_code_any(self, ctx: TenantContext, emp_code: str) -> MasterEmployee | None:
        stmt = select(MasterEmployee).where(
            MasterEmployee.tenant_id == ctx.tenant_id,
            MasterEmployee.is_deleted.is_(False),
            MasterEmployee.employee_code.ilike(emp_code),
        )
        return self._db.scalar(stmt)

    def _index_companies(self, companies) -> dict[str, object]:
        out: dict[str, object] = {}
        for c in companies:
            name = _norm(getattr(c, "company_name", "") or "")
            legal = _norm(getattr(c, "legal_name", "") or "")
            code = _norm(getattr(c, "company_code", "") or "")
            key = None
            blob = f"{name} {legal} {code}"
            if "digitech" in blob and "technolog" not in name and "technolog" not in legal:
                key = "digitech"
            elif "technolog" in blob:
                key = "technology"
            if key and key not in out:
                out[key] = c
            if code:
                out[code] = c
            if name:
                out[name] = c
            if legal:
                out[legal] = c
        return out

    def _resolve_company(
        self,
        entity_raw,
        org_raw,
        emp_code,
        company_by_key,
        companies,
        default_company,
        warnings,
        idx,
    ):
        key = _infer_entity_key(entity_raw, org_raw, emp_code)
        if key and key in company_by_key:
            return company_by_key[key]

        for raw in (entity_raw, org_raw, f"{org_raw} {entity_raw}".strip()):
            n = _norm(raw)
            if not n or n == "cache":
                continue
            if n in company_by_key:
                return company_by_key[n]
            for c in companies:
                name = _norm(getattr(c, "company_name", "") or "")
                legal = _norm(getattr(c, "legal_name", "") or "")
                code = _norm(getattr(c, "company_code", "") or "")
                if n in {name, legal, code} or (len(n) > 3 and (n in name or n in legal)):
                    return c

        if entity_raw or org_raw:
            warnings.append(
                f"Row {idx}: entity/organisation "
                f"'{entity_raw or org_raw}' not matched — using {default_company.company_name}"
            )
        return default_company

    def _default_branch(self, ctx, company_id: UUID, cache: dict[UUID, UUID]) -> UUID:
        if company_id in cache:
            return cache[company_id]
        branches = self._branches.list_branches(ctx, company_id=company_id)
        if not branches:
            raise ValueError(f"No branch found for company {company_id}")
        pick = next(
            (
                b
                for b in branches
                if "hq" in _norm(b.branch_name)
                or "head" in _norm(b.branch_name)
                or "kailash" in _norm(b.branch_name)
            ),
            branches[0],
        )
        cache[company_id] = pick.id
        return pick.id

    def _ensure_department(
        self,
        ctx: TenantContext,
        company_id: UUID,
        branch_id: UUID,
        name: str,
        cache: dict[tuple[UUID, str], UUID],
    ) -> UUID:
        key = (company_id, _norm(name))
        if key in cache:
            return cache[key]
        existing = self._departments.list_departments(ctx, company_id=company_id, branch_id=branch_id)
        for d in existing:
            if _norm(d.department_name) == key[1]:
                cache[key] = d.id
                return d.id
        for d in self._departments.list_departments(ctx, company_id=company_id):
            if _norm(d.department_name) == key[1] and d.branch_id == branch_id:
                cache[key] = d.id
                return d.id
        created = self._departments.create_department(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            department_code=_code_slug(name, "DEPT", 50),
            department_name=name.strip(),
        )
        cache[key] = created.id
        return created.id

    def _ensure_designation(
        self,
        ctx: TenantContext,
        company_id: UUID,
        name: str,
        cache: dict[tuple[UUID, str], UUID],
    ) -> UUID:
        key = (company_id, _norm(name))
        if key in cache:
            return cache[key]
        rows = self._designations.list(ctx, company_id)
        for r in rows:
            if _norm(r.designation_name) == key[1]:
                cache[key] = r.id
                return r.id
        created = self._designations.create(
            ctx,
            company_id=company_id,
            designation_code=_code_slug(name, "DES", 50),
            designation_name=name.strip(),
            status="active",
        )
        cache[key] = created.id
        return created.id

    def _ensure_designation_assignment(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        employee_id: UUID,
        designation_id: UUID,
        joining: date,
    ) -> None:
        stmt = select(HrDesignationAssignment).where(
            HrDesignationAssignment.employee_id == employee_id,
            HrDesignationAssignment.is_deleted.is_(False),
            HrDesignationAssignment.status == "active",
        )
        active = list(self._db.scalars(stmt).all())
        for row in active:
            if row.designation_id == designation_id:
                return
            row.status = "ended"
            row.effective_to = joining
            row.updated_by = ctx.user_id

        self._desig_asg.create(
            ctx,
            branch_id=branch_id,
            employee_id=employee_id,
            designation_id=designation_id,
            effective_from=joining,
            company_id=company_id,
            is_primary=True,
            status="active",
            sync_master_label=True,
        )

    def _ensure_location(
        self,
        ctx: TenantContext,
        company_id: UUID,
        branch_id: UUID,
        name: str,
        cache: dict[tuple[UUID, str], tuple[UUID, str]],
    ) -> tuple[UUID, str]:
        key = (company_id, _norm(name))
        if key in cache:
            return cache[key]

        locs = self._locations.list_locations(ctx, company_id=company_id)
        for loc in locs:
            if _norm(loc.location_name) == key[1] or _norm(
                getattr(loc, "branch_name", "") or ""
            ) == key[1]:
                if getattr(loc, "status", None) == "draft":
                    try:
                        self._locations.update_location(ctx, loc.id, status="active")
                    except Exception:  # noqa: BLE001
                        pass
                pair = (loc.id, loc.location_name)
                cache[key] = pair
                return pair

        branches = self._branches.list_branches(ctx, company_id=company_id)
        use_branch = branch_id
        for b in branches:
            if key[1] in _norm(b.branch_name) or key[1] in _norm(getattr(b, "city", "") or ""):
                use_branch = b.id
                break

        created = self._locations.create_location(
            ctx,
            company_id=company_id,
            branch_id=use_branch,
            location_code=_code_slug(name, "LOC", 50),
            location_name=name.strip(),
            location_type="office",
            status="active",
        )
        row = self._db.get(OrgLocation, created.id)
        if row is not None and row.status != "active":
            row.status = "active"

        pair = (created.id, created.location_name)
        cache[key] = pair
        return pair

    def _upsert_employment(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        employee_id: UUID,
        joining: date,
        work_location: str | None,
    ) -> None:
        stmt = select(HrEmployment).where(
            HrEmployment.employee_id == employee_id,
            HrEmployment.is_deleted.is_(False),
        )
        existing = self._db.scalar(stmt)
        if existing:
            fields: dict = {
                "date_of_joining": joining,
                "status": "active",
                "company_id": company_id,
                "branch_id": branch_id,
            }
            if work_location:
                fields["work_location_text"] = work_location
            self._employment.update(ctx, existing.id, **fields)
            return
        self._employment.create(
            ctx,
            branch_id=branch_id,
            employee_id=employee_id,
            company_id=company_id,
            employment_type="permanent",
            date_of_joining=joining,
            status="active",
            payroll_eligible=True,
            lifecycle_source="bulk_import",
            work_location_text=work_location,
        )

    def _resolve_manager(self, manager_raw: str, code_to_id: dict[str, UUID]) -> UUID | None:
        raw = manager_raw.strip()
        if not raw:
            return None
        needle = _norm(raw).replace(".", " ")
        needle = re.sub(r"\s+", " ", needle).strip()
        if needle in {"na", "n/a", "n.a", "-", "none", "nil", "null"}:
            return None
        code = raw.upper()
        if code in code_to_id:
            return code_to_id[code]
        if not code_to_id:
            return None
        stmt = select(MasterEmployee).where(
            MasterEmployee.is_deleted.is_(False),
            MasterEmployee.id.in_(list(code_to_id.values())),
        )
        needle_parts = needle.split()
        for emp in self._db.scalars(stmt).all():
            full = _norm(f"{emp.first_name} {emp.last_name}").replace(".", " ")
            full = re.sub(r"\s+", " ", full).strip()
            if needle == full or needle in full or full in needle:
                return emp.id
            if emp.employee_code and _norm(emp.employee_code) == needle:
                return emp.id
            full_parts = full.split()
            if len(needle_parts) >= 2 and len(full_parts) >= 2:
                if needle_parts[0] == full_parts[0] and needle_parts[-1] == full_parts[-1]:
                    return emp.id
        return None
