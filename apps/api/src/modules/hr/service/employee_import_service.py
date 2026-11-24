"""Bulk employee Excel/CSV import - upsert by employee code (no duplicates)."""

from __future__ import annotations

import re
from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from core.exceptions import ConflictException
from modules.foundation.domain.org_data_scope import has_module_wide_data_access
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.domain.enums import HrEntityType
from modules.hr.models import HrDesignationAssignment, HrEmployeeProfile, HrEmployment
from modules.hr.repository.base import utcnow as hr_utcnow
from modules.hr.service.assignment_service import DesignationAssignmentService
from modules.hr.service.designation_service import DesignationService
from modules.hr.service.document_number_service import DocumentNumberService
from modules.hr.service.employment_service import EmploymentService
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.published import EmployeeCommands, EmployeeRead
from modules.master_data.service.employee_service import EmployeeService
from modules.organization.models.branch import OrgBranch
from modules.organization.models.company import OrgCompany
from modules.organization.models.hierarchy import OrgDepartment, OrgLocation
from modules.organization.service.branch_service import BranchService
from modules.organization.service.company_service import CompanyService
from modules.organization.service.hierarchy_service import DepartmentService, LocationService
from security.field_crypto import pii_lookup

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

# One shared department name for every legal entity (import ignores Excel Department FK).
SHARED_IMPORT_DEPARTMENT = "General"

# Ensure these two operating companies exist for Cache Excel uploads
ENTITY_COMPANY_SPECS: dict[str, dict[str, str]] = {
    "digitech": {
        "company_code": "DEMOCO",
        "alt_codes": "CACHEDIG",
        "company_name": "Cache Digitech",
        "legal_name": "Cache Digitech",
        "employee_code_prefix": "CDPL",
        "branch_code": "HQ",
        "branch_name": "Head Office",
        "city": "Bengaluru",
    },
    "technology": {
        "company_code": "CACHETECH",
        "alt_codes": "",
        # Entity under parent Organisation "Cache" (not "…& Infotech")
        "company_name": "Cache Technologies",
        "legal_name": "Cache Technologies",
        "employee_code_prefix": "CT",
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


def _parse_optional_date(raw: str | None) -> date | None:
    text = (raw or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


def _normalize_gender(raw: str | None) -> str | None:
    """Map Excel Gender cells to male | female | other.

    Handles common sheet variants: Male/Female, M/F, 1/0, trailing spaces,
    punctuation, and zero-width characters from Excel copy/paste.
    """
    if raw is None:
        return None
    text = str(raw).replace("\ufeff", "").strip()
    if not text:
        return None
    # Numbers / codes sometimes come from Excel data validation
    if text in {"1", "1.0"}:
        return "male"
    if text in {"2", "2.0", "0", "0.0"}:
        return "female"
    n = _norm(text)
    n = re.sub(r"[^\w\s\-]+", "", n, flags=re.UNICODE).strip()
    n = re.sub(r"\s+", " ", n)
    if not n:
        return None
    if n in {"m", "male", "man", "boy", "masculino"}:
        return "male"
    if n in {"f", "female", "woman", "girl", "femenino", "feminine"}:
        return "female"
    if n in {
        "o",
        "other",
        "non-binary",
        "nonbinary",
        "non binary",
        "nb",
        "trans",
        "prefer not to say",
        "prefer_not_to_say",
    }:
        return "other"
    # Ignore junk placeholders
    if n in {"-", "na", "n/a", "n.a", "none", "nil", "null", "tbd", "unknown"}:
        return None
    # Short codes: M / F / Mo / Fe …
    if len(n) <= 6 and n.startswith("m") and not n.startswith("miss"):
        return "male"
    if len(n) <= 6 and n.startswith("f"):
        return "female"
    return n


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
    """Legacy alias map for Entity/Organisation text → digitech | technology."""
    combined = " ".join(p for p in (_norm(org_raw), _norm(entity_raw)) if p).strip()
    for candidate in (entity_raw, org_raw, combined):
        key = _entity_key(candidate)
        if key:
            return key
    return None


def _normalize_prefix(raw: str | None) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", (raw or "").strip().upper())


def _effective_emp_prefix(company) -> str:
    """Prefer employee_code_prefix; else letters/digits from company_code."""
    explicit = _normalize_prefix(getattr(company, "employee_code_prefix", None) or "")
    if explicit:
        return explicit
    return _normalize_prefix(getattr(company, "company_code", None) or "")


def _match_company_by_emp_code_prefix(emp_code: str, companies: list) -> object | None:
    """Longest prefix match of Emp Code against entity employee_code_prefix values.

    Requires the character after the prefix to be a digit (or end of code) so a
    short prefix like ``CT`` does not steal ``CDPL…`` codes.
    """
    code = _normalize_prefix(emp_code)
    if not code:
        return None
    scored: list[tuple[int, object]] = []
    for company in companies:
        prefix = _effective_emp_prefix(company)
        if not prefix:
            continue
        if code == prefix:
            scored.append((len(prefix), company))
            continue
        if not code.startswith(prefix) or len(code) <= len(prefix):
            continue
        rest = code[len(prefix) :]
        # CT + 5301 OK; CT matching CDPL… rejected (next char is a letter).
        if rest[:1].isdigit():
            scored.append((len(prefix), company))
    if not scored:
        return None
    scored.sort(key=lambda item: item[0], reverse=True)
    return scored[0][1]


def _normalize_workforce_tag(raw: object | None) -> str | None:
    text = re.sub(r"\s+", "_", str(raw or "").strip().lower())
    text = re.sub(r"[^a-z0-9_\-]+", "", text)
    return text or None


def _skills_tags(skills_json: object | None) -> list[str]:
    if not isinstance(skills_json, dict):
        return []
    raw = skills_json.get("tags")
    if isinstance(raw, list):
        out: list[str] = []
        for item in raw:
            tag = _normalize_workforce_tag(item)
            if tag and tag not in out:
                out.append(tag)
        return out
    if isinstance(raw, str):
        tag = _normalize_workforce_tag(raw)
        return [tag] if tag else []
    return []


def _merge_skills_meta(
    skills_json: object | None,
    *,
    tag: str | None = None,
    deployed_at: str | None = None,
) -> dict | None:
    base: dict
    if isinstance(skills_json, dict):
        base = dict(skills_json)
    elif isinstance(skills_json, list):
        base = {"items": skills_json}
    else:
        base = {}
    normalized = _normalize_workforce_tag(tag)
    if normalized:
        tags = _skills_tags(base)
        if normalized not in tags:
            tags.append(normalized)
        base["tags"] = tags
    site = str(deployed_at or "").strip()
    if site:
        base["deployed_at"] = site
    return base or None


def _merge_skills_tag(skills_json: object | None, tag: str | None) -> dict | None:
    return _merge_skills_meta(skills_json, tag=tag)


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
        self._doc_numbers = DocumentNumberService(db)

    def clear_all_employees(self, ctx: TenantContext) -> dict:
        """Soft-delete employees and liberate unique codes/emails for re-import."""
        from datetime import datetime, timezone

        stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        stmt = select(EmployeeRead).where(
            EmployeeRead.tenant_id == ctx.tenant_id,
            EmployeeRead.is_deleted.is_(False),
        )
        if ctx.company_id and not has_module_wide_data_access(ctx, "hr"):
            stmt = stmt.where(EmployeeRead.company_id == ctx.company_id)

        rows = list(self._db.scalars(stmt).all())
        commands = EmployeeCommands(self._db)
        deleted = 0
        for i, row in enumerate(rows):
            # Free unique (company_id, employee_code) and (company_id, email)
            commands.soft_delete_freeing_identity(
                row.id, suffix=f"{stamp}-{i}", deleted_by=ctx.user_id
            )
            deleted += 1

        self._db.flush()
        return {
            "deleted": deleted,
            "message": f"Soft-deleted {deleted} employee(s). Codes freed for re-import.",
        }

    def import_rows(
        self,
        ctx: TenantContext,
        rows: list[dict],
        *,
        company_id: str | UUID | None = None,
    ) -> dict:
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

        # After org wipe/re-seed, keep the importer's entity dropdown scopes valid.
        self._refresh_importer_org_scopes(ctx, companies)

        company_by_key = self._index_companies(companies)
        default_company = company_by_key.get("digitech") or companies[0]
        forced_company = None
        if company_id:
            try:
                cid = company_id if isinstance(company_id, UUID) else UUID(str(company_id))
            except ValueError:
                return {
                    "created": 0,
                    "updated": 0,
                    "skipped": len(rows),
                    "warnings": [],
                    "errors": [f"Invalid company_id '{company_id}'."],
                    "results": [],
                }
            forced_company = next((c for c in companies if c.id == cid), None)
            if forced_company is None:
                return {
                    "created": 0,
                    "updated": 0,
                    "skipped": len(rows),
                    "warnings": [],
                    "errors": ["Selected legal entity was not found. Refresh and try again."],
                    "results": [],
                }

        dept_cache: dict[tuple[UUID, UUID, str], UUID] = {}
        desig_cache: dict[tuple[UUID, str], UUID] = {}
        loc_cache: dict[tuple[UUID, str], tuple[UUID, str]] = {}
        branch_by_company: dict[UUID, UUID] = {}

        created = 0
        updated = 0
        skipped = 0
        warnings: list[str] = []
        errors: list[str] = []
        results: list[dict] = []
        gender_saved = 0
        gender_blank = 0
        gender_unrecognized = 0
        code_to_id: dict[str, UUID] = {}

        for c in companies:
            for emp in self._employees.list_employees(ctx, company_id=c.id):
                code_to_id[emp.employee_code.strip().upper()] = emp.id

        pending_managers: list[tuple[UUID, str, str]] = []

        for idx, raw in enumerate(rows, start=2):
            # Nested savepoint: one bad row must not poison the whole batch session.
            try:
                with self._db.begin_nested():
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
                    if forced_company is not None:
                        company = forced_company
                    else:
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

                    previous_code = str(
                        raw.get("previous_employee_code")
                        or raw.get("old_employee_code")
                        or ""
                    ).strip().upper()
                    designation_name = str(raw.get("designation") or "Staff").strip() or "Staff"
                    base_location = str(raw.get("base_location") or "").strip()
                    manager_raw = str(raw.get("reporting_manager") or "").strip()
                    email = str(raw.get("email") or "").strip()
                    mobile = str(raw.get("mobile") or "").strip() or "0000000000"
                    joining = _parse_date(str(raw.get("joining_date") or ""))
                    gender_raw = str(raw.get("gender") or "").strip()
                    gender = _normalize_gender(gender_raw)
                    dob = _parse_optional_date(
                        str(raw.get("dob") or raw.get("date_of_birth") or "")
                    )
                    if gender:
                        gender_saved += 1
                    elif gender_raw:
                        gender_unrecognized += 1
                        if gender_unrecognized <= 5:
                            warnings.append(
                                f"Row {idx} ({emp_code}): Gender '{gender_raw}' not recognized — skipped"
                            )
                    else:
                        gender_blank += 1

                    if not email:
                        email = f"{emp_code.lower().replace(' ', '')}@import.cache.local"

                    designation_id = self._ensure_designation(
                        ctx, company.id, designation_name, desig_cache
                    )
                    work_location: str | None = None
                    if base_location:
                        _loc_id, work_location = self._ensure_location(
                            ctx, company.id, branch_id, base_location, loc_cache
                        )

                    # Upsert by New E code, else previous EMPLOYEE ID (code rename support).
                    existing = self._find_by_code_any(ctx, emp_code)
                    if existing is None and previous_code and previous_code != emp_code:
                        existing = self._find_by_code_any(ctx, previous_code)

                    # Excel Department is optional (UI often skips it). Always resolve a
                    # department that belongs to this company+branch — never fail import.
                    department_raw = str(raw.get("department") or "").strip()
                    department_skipped = not department_raw
                    dept_id = self._resolve_import_department(
                        ctx,
                        company_id=company.id,
                        branch_id=branch_id,
                        department_raw=department_raw,
                        department_skipped=department_skipped,
                        existing=existing,
                        dept_cache=dept_cache,
                    )
                    if existing:
                        next_email = email
                        if (
                            "@import.cache.local" in email
                            and existing.email
                            and "@import.cache.local" not in str(existing.email)
                        ):
                            next_email = str(existing.email)

                        next_email, email_note = self._resolve_import_email(
                            company_id=company.id,
                            preferred=next_email,
                            emp_code=emp_code,
                            exclude_id=existing.id,
                        )
                        if email_note:
                            warnings.append(f"Row {idx} ({emp_code}): {email_note}")

                        # Company move: free email + EMPL doc in *target* before company_id flips
                        # (uk_master_employee_company_email / uk_hr_empl_company_doc).
                        moved_company = existing.company_id != company.id
                        if moved_company:
                            next_email = self._prepare_company_move(
                                ctx,
                                employee_id=existing.id,
                                target_company_id=company.id,
                                target_branch_id=branch_id,
                                preferred_email=next_email,
                                emp_code=emp_code,
                                row_idx=idx,
                                warnings=warnings,
                            )

                        update_fields: dict = {
                            "first_name": first_name,
                            "last_name": last_name,
                            "mobile": mobile if mobile != "0000000000" else existing.mobile,
                            "designation": designation_name,
                            "date_of_joining": joining,
                            "status": "active",
                        }
                        # Department column skipped (typical RM/name/code re-import):
                        # never touch branch or department — existing placement stays.
                        # Only remount branch/dept when company moves or Excel maps Department.
                        work_branch_id = existing.branch_id or branch_id
                        if moved_company:
                            # Prefer Excel Department when mapped; else resolved dept / General.
                            move_dept = dept_id
                            if department_skipped or not self._department_belongs_to_branch(
                                ctx, move_dept, branch_id, company_id=company.id
                            ):
                                move_dept = self._ensure_department(
                                    ctx,
                                    company.id,
                                    branch_id,
                                    department_raw or SHARED_IMPORT_DEPARTMENT,
                                    dept_cache,
                                )
                            update_fields["branch_id"] = branch_id
                            update_fields["department_id"] = move_dept
                            work_branch_id = branch_id
                        elif not department_skipped:
                            if existing.branch_id != branch_id:
                                update_fields["branch_id"] = branch_id
                                update_fields["department_id"] = dept_id
                                work_branch_id = branch_id
                            elif existing.department_id != dept_id:
                                update_fields["department_id"] = dept_id
                            elif not self._department_belongs_to_branch(
                                ctx,
                                existing.department_id,
                                existing.branch_id or branch_id,
                                company_id=existing.company_id or company.id,
                            ):
                                update_fields["department_id"] = dept_id
                        # Rename CDPL… → CT… / CCPL… / VPL… when Excel has New E codes.
                        existing_code = str(existing.employee_code or "").strip().upper()
                        if emp_code and emp_code != existing_code:
                            update_fields["employee_code"] = emp_code

                        # After a company move email is already forced on the ORM row.
                        # Same-company updates still go through EmployeeService (with fallback).
                        if not moved_company and next_email:
                            current_email = str(existing.email or "")
                            if next_email != current_email:
                                if self._email_available(
                                    company.id, next_email, exclude_id=existing.id
                                ):
                                    update_fields["email"] = next_email
                                else:
                                    warnings.append(
                                        f"Row {idx} ({emp_code}): kept existing email — "
                                        f"'{next_email}' already used in this company"
                                    )

                        try:
                            self._employees.update_employee(
                                ctx,
                                existing.id,
                                skip_department_validation=True,
                                **update_fields,
                            )
                        except ConflictException as exc:
                            msg = str(exc)
                            if "email" in update_fields and "email" in msg.lower():
                                update_fields.pop("email", None)
                                fallback, note = self._resolve_import_email(
                                    company_id=company.id,
                                    preferred=f"{emp_code.lower()}@import.cache.local",
                                    emp_code=emp_code,
                                    exclude_id=existing.id,
                                )
                                self._force_employee_email(existing.id, fallback)
                                warnings.append(
                                    f"Row {idx} ({emp_code}): {note or exc} — used {fallback}"
                                )
                                self._employees.update_employee(
                                    ctx,
                                    existing.id,
                                    skip_department_validation=True,
                                    **update_fields,
                                )
                            elif "department" in msg.lower():
                                # Drop placement fields and retry identity-only update.
                                update_fields.pop("department_id", None)
                                update_fields.pop("branch_id", None)
                                self._employees.update_employee(
                                    ctx,
                                    existing.id,
                                    skip_department_validation=True,
                                    **update_fields,
                                )
                                warnings.append(
                                    f"Row {idx} ({emp_code}): kept existing department/branch "
                                    f"({exc})"
                                )
                            else:
                                raise
                        emp_id = existing.id
                        self._upsert_employment(
                            ctx,
                            company_id=company.id,
                            branch_id=work_branch_id,
                            employee_id=emp_id,
                            joining=joining,
                            work_location=work_location,
                        )
                        self._upsert_profile(
                            ctx,
                            company_id=company.id,
                            branch_id=work_branch_id,
                            employee_id=emp_id,
                            gender=gender,
                            date_of_birth=dob,
                            raw=raw,
                        )
                        updated += 1
                        action = "updated"
                    else:
                        create_email, email_note = self._resolve_import_email(
                            company_id=company.id,
                            preferred=email,
                            emp_code=emp_code,
                            exclude_id=None,
                        )
                        if email_note:
                            warnings.append(f"Row {idx} ({emp_code}): {email_note}")
                        created_emp = self._employees.create_employee(
                            ctx,
                            company_id=company.id,
                            branch_id=branch_id,
                            department_id=dept_id,
                            employee_code=emp_code,
                            first_name=first_name,
                            last_name=last_name,
                            email=create_email,
                            mobile=mobile,
                            designation=designation_name,
                            date_of_joining=joining,
                            bypass_onboarding=True,
                            status="active",
                            skip_department_validation=True,
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
                        self._upsert_profile(
                            ctx,
                            company_id=company.id,
                            branch_id=branch_id,
                            employee_id=emp_id,
                            gender=gender,
                            date_of_birth=dob,
                            raw=raw,
                        )
                        created += 1
                        action = "created"

                    assign_branch = branch_id
                    if (
                        existing is not None
                        and department_skipped
                        and existing.company_id == company.id
                    ):
                        assign_branch = existing.branch_id or branch_id
                    self._ensure_designation_assignment(
                        ctx,
                        company_id=company.id,
                        branch_id=assign_branch,
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
            except Exception as exc:  # noqa: BLE001 - collect row errors
                msg = str(exc)
                # Department/branch mismatches must not block name/code/RM imports.
                if "department" in msg.lower() and "branch" in msg.lower():
                    warnings.append(
                        f"Row {idx}: {exc} — retried without department/branch change"
                    )
                    dept_cache.clear()
                    try:
                        with self._db.begin_nested():
                            emp_code_retry = str(raw.get("employee_code") or "").strip().upper()
                            name_retry = str(raw.get("name") or "").strip()
                            if emp_code_retry and name_retry:
                                existing_retry = self._find_by_code_any(ctx, emp_code_retry)
                                prev_retry = str(
                                    raw.get("previous_employee_code")
                                    or raw.get("old_employee_code")
                                    or ""
                                ).strip().upper()
                                if existing_retry is None and prev_retry:
                                    existing_retry = self._find_by_code_any(ctx, prev_retry)
                                if existing_retry is not None:
                                    fn, ln = _split_name(name_retry)
                                    self._employees.update_employee(
                                        ctx,
                                        existing_retry.id,
                                        skip_department_validation=True,
                                        first_name=fn,
                                        last_name=ln,
                                        designation=str(raw.get("designation") or "Staff").strip()
                                        or "Staff",
                                        status="active",
                                    )
                                    code_to_id[emp_code_retry] = existing_retry.id
                                    mgr = str(raw.get("reporting_manager") or "").strip()
                                    if mgr:
                                        pending_managers.append(
                                            (existing_retry.id, emp_code_retry, mgr)
                                        )
                                    updated += 1
                                    results.append(
                                        {
                                            "row": idx,
                                            "employee_code": emp_code_retry,
                                            "action": "updated",
                                            "employee_id": str(existing_retry.id),
                                            "company": "",
                                            "entity": None,
                                            "base_location": "",
                                            "designation": str(raw.get("designation") or ""),
                                        }
                                    )
                                    continue
                    except Exception as retry_exc:  # noqa: BLE001
                        warnings.append(f"Row {idx}: department retry failed — {retry_exc}")
                # Nested rollback undoes master inserts; drop caches so IDs are not reused.
                dept_cache.clear()
                desig_cache.clear()
                loc_cache.clear()
                branch_by_company.clear()
                skipped += 1
                errors.append(f"Row {idx}: {exc}")

        tagged_manager_ids: set = set()
        for emp_id, emp_code, manager_raw in pending_managers:
            mgr_id = self._resolve_manager(manager_raw, code_to_id)
            if not mgr_id:
                warnings.append(
                    f"{emp_code}: reporting manager '{manager_raw}' not found - left blank"
                )
                continue
            if mgr_id == emp_id:
                warnings.append(f"{emp_code}: cannot be own reporting manager")
                continue
            try:
                with self._db.begin_nested():
                    self._employees.update_employee(
                        ctx,
                        emp_id,
                        reporting_manager_id=mgr_id,
                    )
                    tagged_manager_ids.add(mgr_id)
            except Exception as exc:  # noqa: BLE001
                warnings.append(f"{emp_code}: manager link failed - {exc}")

        # Anyone assigned as a reporting manager gets the Manager people-role flag.
        for mgr_id in tagged_manager_ids:
            mgr = self._db.get(MasterEmployee, mgr_id)
            if mgr is None or getattr(mgr, "is_deleted", False):
                continue
            if getattr(mgr, "is_manager", False):
                continue
            mgr.is_manager = True
            mgr.updated_at = hr_utcnow()
            mgr.updated_by = ctx.user_id
            mgr.version = int(getattr(mgr, "version", 1) or 1) + 1

        self._db.flush()
        if gender_saved:
            warnings.insert(
                0,
                f"Gender saved on {gender_saved} employee profile(s).",
            )
        if gender_blank:
            warnings.append(
                f"{gender_blank} row(s) had empty Gender — map the Gender column and re-import those rows.",
            )
        if gender_unrecognized > 5:
            warnings.append(
                f"{gender_unrecognized - 5} more row(s) had unrecognized Gender values.",
            )
        return {
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "warnings": warnings[:200],
            "errors": errors[:200],
            "results": results,
        }

    def _refresh_importer_org_scopes(self, ctx: TenantContext, companies: list) -> None:
        """Replace stale user org scopes (pointing at deleted companies) with live entities."""
        from modules.organization.repository.org_scope_repository import OrgScopeRepository

        if not companies or not ctx.user_id:
            return
        scopes = OrgScopeRepository(self._db)
        existing = scopes.list_user_scopes(ctx.user_id, ctx.tenant_id)
        live_ids = {c.id for c in companies}
        if existing and all(s.company_id in live_ids for s in existing):
            return
        default = next(
            (c.id for c in companies if "digitech" in _norm(getattr(c, "company_name", ""))),
            companies[0].id,
        )
        scopes.replace_company_scopes(
            ctx,
            user_id=ctx.user_id,
            company_ids=[c.id for c in companies],
            default_company_id=default,
        )

    def _ensure_entity_companies(self, ctx: TenantContext) -> None:
        """Undelete/create Cache Digitech + Cache Technologies so Entity column can map."""
        # Drop legacy wrong name "Cache Technologies & Infotech"
        for legacy in self._db.scalars(
            select(OrgCompany).where(
                OrgCompany.tenant_id == ctx.tenant_id,
                OrgCompany.company_name.ilike("%Infotech%"),
            )
        ).all():
            legacy.company_name = "Cache Technologies"
            legacy.legal_name = "Cache Technologies"
            legacy.updated_by = ctx.user_id
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
                    employee_code_prefix=spec.get("employee_code_prefix") or None,
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
                if not (company.employee_code_prefix or "").strip() and spec.get(
                    "employee_code_prefix"
                ):
                    company.employee_code_prefix = spec["employee_code_prefix"]
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

    def _find_by_code_any(self, ctx: TenantContext, emp_code: str) -> EmployeeRead | None:
        stmt = select(EmployeeRead).where(
            EmployeeRead.tenant_id == ctx.tenant_id,
            EmployeeRead.is_deleted.is_(False),
            EmployeeRead.employee_code.ilike(emp_code),
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
            prefix = _effective_emp_prefix(c)
            if prefix:
                out[f"prefix:{prefix}"] = c
                out[prefix.lower()] = c
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
        # 1) Primary: Emp Code prefix set on Legal Entity (CDPL0001 → Digitech, VPL0001 → Vyuha)
        by_prefix = _match_company_by_emp_code_prefix(emp_code, companies)
        if by_prefix is not None:
            return by_prefix

        # 2) Entity / Organisation column against name, legal name, company code
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
                prefix = _effective_emp_prefix(c).lower()
                if n in {name, legal, code, prefix} or (
                    len(n) > 3 and (n in name or n in legal)
                ):
                    return c

        # 3) Legacy digitech/technology aliases (Entity text only)
        key = _infer_entity_key(entity_raw, org_raw, emp_code)
        if key and key in company_by_key:
            return company_by_key[key]

        label = entity_raw or org_raw or emp_code
        if len(companies) > 1:
            warnings.append(
                f"Row {idx}: could not match Emp Code/Entity '{label}' "
                f"to a Legal Entity prefix — using {default_company.company_name}. "
                f"Set Employee code prefix on the entity (e.g. CDPL, CT, VPL)."
            )
        elif entity_raw or org_raw:
            warnings.append(
                f"Row {idx}: entity/organisation "
                f"'{entity_raw or org_raw}' not matched - using {default_company.company_name}"
            )
        return default_company

    def _default_branch(self, ctx, company_id: UUID, cache: dict[UUID, UUID]) -> UUID:
        if company_id in cache:
            return cache[company_id]
        branches = self._branches.list_branches(ctx, company_id=company_id)
        if branches:
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

        # Reactivate a soft-deleted branch if present (common after org cleanup).
        existing = self._db.scalar(
            select(OrgBranch).where(
                OrgBranch.tenant_id == ctx.tenant_id,
                OrgBranch.company_id == company_id,
            ).order_by(OrgBranch.is_deleted.asc(), OrgBranch.created_at.asc())
        )
        if existing is not None:
            existing.is_deleted = False
            existing.deleted_at = None
            existing.deleted_by = None
            existing.status = "active"
            existing.updated_by = ctx.user_id
            self._db.flush()
            cache[company_id] = existing.id
            return existing.id

        # Auto-create Head Office so import does not fail when Org Setup has no branch yet.
        branch = OrgBranch(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_code="HQ",
            branch_name="Head Office",
            branch_type="head_office",
            city="Bengaluru",
            country_code="IN",
            status="active",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(branch)
        self._db.flush()
        cache[company_id] = branch.id
        return branch.id

    def _resolve_import_department(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        department_raw: str,
        department_skipped: bool,
        existing: EmployeeRead | None,
        dept_cache: dict[tuple[UUID, UUID, str], UUID],
    ) -> UUID:
        """Pick a department that always belongs to ``company_id`` + ``branch_id``."""
        if department_skipped and existing is not None:
            current_id = getattr(existing, "department_id", None)
            # Keep current dept when it already matches the employee branch (common on RM-only reimport).
            emp_branch = getattr(existing, "branch_id", None) or branch_id
            emp_company = getattr(existing, "company_id", None) or company_id
            if current_id and self._department_belongs_to_branch(
                ctx, current_id, emp_branch, company_id=emp_company
            ):
                return current_id
            return self._ensure_department(
                ctx, company_id, branch_id, SHARED_IMPORT_DEPARTMENT, dept_cache
            )

        name = department_raw.strip() or SHARED_IMPORT_DEPARTMENT
        dept_id = self._ensure_department(ctx, company_id, branch_id, name, dept_cache)
        if not self._department_belongs_to_branch(
            ctx, dept_id, branch_id, company_id=company_id
        ):
            return self._ensure_department(
                ctx, company_id, branch_id, SHARED_IMPORT_DEPARTMENT, dept_cache
            )
        return dept_id

    def _department_belongs_to_branch(
        self,
        ctx: TenantContext,
        department_id: UUID,
        branch_id: UUID,
        *,
        company_id: UUID | None = None,
    ) -> bool:
        row = self._db.get(OrgDepartment, department_id)
        if row is None or row.is_deleted or row.tenant_id != ctx.tenant_id:
            return False
        if row.branch_id != branch_id:
            return False
        if company_id is not None and row.company_id != company_id:
            return False
        return True

    def _ensure_department(
        self,
        ctx: TenantContext,
        company_id: UUID,
        branch_id: UUID,
        name: str,
        cache: dict[tuple[UUID, UUID, str], UUID],
    ) -> UUID:
        """Get-or-create department strictly under company + branch (direct ORM).

        Never reuse Digitech/Vyuha/Calipers departments by name alone — that caused
        \"Department does not belong to the specified branch\" on employee upsert.
        """
        clean = (name or "").strip() or "General"
        norm = _norm(clean)
        key = (company_id, branch_id, norm)
        if key in cache:
            return cache[key]

        # Active match on this company + branch (bypass org list company-scope filters).
        active = self._db.scalars(
            select(OrgDepartment).where(
                OrgDepartment.tenant_id == ctx.tenant_id,
                OrgDepartment.company_id == company_id,
                OrgDepartment.branch_id == branch_id,
                OrgDepartment.is_deleted.is_(False),
            )
        ).all()
        for row in active:
            if _norm(row.department_name) == norm:
                cache[key] = row.id
                return row.id

        code = _code_slug(clean, "DEPT", 50)

        # Reactivate soft-deleted row on this branch with same name or code.
        revived = self._db.scalar(
            select(OrgDepartment).where(
                OrgDepartment.tenant_id == ctx.tenant_id,
                OrgDepartment.branch_id == branch_id,
                OrgDepartment.is_deleted.is_(True),
                (
                    (OrgDepartment.department_code == code)
                    | (OrgDepartment.department_name.ilike(clean))
                ),
            ).order_by(OrgDepartment.updated_at.desc())
        )
        if revived is not None:
            revived.is_deleted = False
            revived.deleted_at = None
            revived.deleted_by = None
            revived.company_id = company_id
            revived.branch_id = branch_id
            revived.department_name = clean
            revived.status = "active"
            revived.updated_by = ctx.user_id
            self._db.flush()
            cache[key] = revived.id
            return revived.id

        try:
            with self._db.begin_nested():
                created = self._departments.create_department(
                    ctx,
                    company_id=company_id,
                    branch_id=branch_id,
                    department_code=code,
                    department_name=clean,
                )
            if self._department_belongs_to_branch(
                ctx, created.id, branch_id, company_id=company_id
            ):
                cache[key] = created.id
                return created.id
        except (IntegrityError, ConflictException, Exception):
            pass

        # Unique (branch_id, department_code) or service-scope failure — reuse or force-create.
        existing = self._db.scalar(
            select(OrgDepartment).where(
                OrgDepartment.tenant_id == ctx.tenant_id,
                OrgDepartment.branch_id == branch_id,
                OrgDepartment.department_code == code,
            )
        )
        if existing is None:
            existing = self._db.scalar(
                select(OrgDepartment).where(
                    OrgDepartment.tenant_id == ctx.tenant_id,
                    OrgDepartment.company_id == company_id,
                    OrgDepartment.branch_id == branch_id,
                    OrgDepartment.department_name.ilike(clean),
                )
            )
        if existing is not None:
            existing.is_deleted = False
            existing.deleted_at = None
            existing.deleted_by = None
            existing.company_id = company_id
            existing.branch_id = branch_id
            existing.status = "active"
            existing.updated_by = ctx.user_id
            self._db.flush()
            cache[key] = existing.id
            return existing.id

        # Last resort: insert General/dept directly so import never dies on org scope.
        forced = OrgDepartment(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            department_code=code,
            department_name=clean,
            status="active",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(forced)
        self._db.flush()
        cache[key] = forced.id
        return forced.id

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

    def _email_available(
        self, company_id: UUID, email: str, *, exclude_id: UUID | None
    ) -> bool:
        key = pii_lookup(email)
        if not key:
            return True
        stmt = select(MasterEmployee.id).where(
            MasterEmployee.company_id == company_id,
            MasterEmployee.email_lookup == key,
            MasterEmployee.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(MasterEmployee.id != exclude_id)
        return self._db.scalar(stmt) is None

    def _resolve_import_email(
        self,
        *,
        company_id: UUID,
        preferred: str,
        emp_code: str,
        exclude_id: UUID | None,
    ) -> tuple[str, str | None]:
        """Return an email that won't violate uk_master_employee_company_email."""
        preferred = (preferred or "").strip()
        if preferred and self._email_available(company_id, preferred, exclude_id=exclude_id):
            return preferred, None
        # Prefer stable per-code placeholder first, then a unique suffix.
        candidates = [
            f"{emp_code.lower().replace(' ', '')}@import.cache.local",
            f"{emp_code.lower().replace(' ', '')}.{uuid4().hex[:8]}@import.cache.local",
        ]
        for candidate in candidates:
            if self._email_available(company_id, candidate, exclude_id=exclude_id):
                note = None
                if preferred:
                    note = (
                        f"email '{preferred}' already used in company — "
                        f"saved as {candidate}"
                    )
                return candidate, note
        # Extremely unlikely fallback
        fallback = f"import-{uuid4().hex}@import.cache.local"
        return fallback, f"email collision — saved as {fallback}"

    def _force_employee_email(self, employee_id: UUID, email: str) -> None:
        """Set email + lookup without EmployeeService source-company duplicate checks."""
        row = self._db.get(MasterEmployee, employee_id)
        if row is None:
            return
        row.email = email
        key = pii_lookup(email)
        if key:
            row.email_lookup = key
        flag_modified(row, "email")
        self._db.flush()

    def _employment_doc_taken(
        self, company_id: UUID, document_number: str, *, exclude_id: UUID | None
    ) -> bool:
        stmt = select(HrEmployment.id).where(
            HrEmployment.company_id == company_id,
            HrEmployment.document_number == document_number,
            HrEmployment.is_deleted.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(HrEmployment.id != exclude_id)
        return self._db.scalar(stmt) is not None

    def _allocate_employment_doc(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        exclude_id: UUID | None,
        avoid: str | None = None,
    ) -> str:
        """Allocate EMPL doc unique in company; never reuse ``avoid`` (keeps ORM dirty)."""
        for _ in range(8):
            doc = self._doc_numbers.generate(
                HrEntityType.EMPLOYMENT,
                company_id,
                HrEmployment,
                "document_number",
                tenant_id=ctx.tenant_id,
            )
            if doc != avoid and not self._employment_doc_taken(
                company_id, doc, exclude_id=exclude_id
            ):
                return doc
        # Guaranteed-unique fallback if sequence is stuck / colliding
        return f"EMPL-{uuid4().hex[:12].upper()}"

    def _reassign_employment_company(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID,
        company_id: UUID,
        branch_id: UUID,
    ) -> None:
        """Move hr_employment to target company with a fresh document_number (direct ORM)."""
        rows = list(
            self._db.scalars(
                select(HrEmployment).where(
                    HrEmployment.employee_id == employee_id,
                    HrEmployment.is_deleted.is_(False),
                )
            ).all()
        )
        for row in rows:
            if row.company_id == company_id and row.branch_id == branch_id:
                continue
            new_doc = self._allocate_employment_doc(
                ctx,
                company_id,
                exclude_id=row.id,
                avoid=str(row.document_number or ""),
            )
            row.document_number = new_doc
            row.company_id = company_id
            row.branch_id = branch_id
            row.updated_at = hr_utcnow()
            row.updated_by = ctx.user_id
            flag_modified(row, "document_number")
            flag_modified(row, "company_id")
            flag_modified(row, "branch_id")
        if rows:
            self._db.flush()

    def _prepare_company_move(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID,
        target_company_id: UUID,
        target_branch_id: UUID,
        preferred_email: str,
        emp_code: str,
        row_idx: int,
        warnings: list[str],
    ) -> str:
        """Make email + employment docs safe for target company, then flip master company_id."""
        move_email, note = self._resolve_import_email(
            company_id=target_company_id,
            preferred=preferred_email,
            emp_code=emp_code,
            exclude_id=employee_id,
        )
        if note:
            warnings.append(f"Row {row_idx} ({emp_code}): {note}")

        row = self._db.get(MasterEmployee, employee_id)
        current_email = str(row.email) if row is not None and row.email else ""
        if move_email != current_email or (
            row is not None
            and not self._email_available(
                target_company_id, current_email, exclude_id=employee_id
            )
        ):
            self._force_employee_email(employee_id, move_email)

        # Renumber employment BEFORE master company flip so a partial flush can't
        # land (company_id, old EMPL-n) against an existing target row.
        self._reassign_employment_company(
            ctx,
            employee_id=employee_id,
            company_id=target_company_id,
            branch_id=target_branch_id,
        )
        EmployeeCommands(self._db).move_company(
            employee_id,
            company_id=target_company_id,
            branch_id=target_branch_id,
            updated_by=ctx.user_id,
        )
        return move_email

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
            # Company remaps are handled in _prepare_company_move (forced new EMPL doc).
            # Here only refresh joining / location / ensure company still matches.
            if existing.company_id != company_id:
                self._reassign_employment_company(
                    ctx,
                    employee_id=employee_id,
                    company_id=company_id,
                    branch_id=branch_id,
                )
                existing = self._db.scalar(stmt)
            if existing is None:
                return
            fields: dict = {
                "date_of_joining": joining,
                "status": "active",
                "branch_id": branch_id,
            }
            if work_location:
                fields["work_location_text"] = work_location
            # Prefer direct ORM so HR scope filters can't miss a mid-move row.
            for k, v in fields.items():
                setattr(existing, k, v)
            existing.updated_at = hr_utcnow()
            existing.updated_by = ctx.user_id
            self._db.flush()
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

    def _upsert_profile(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        employee_id: UUID,
        gender: str | None,
        date_of_birth: date | None,
        raw: dict | None = None,
    ) -> None:
        """Persist Excel personal / ID / bank fields onto hr_employee_profile.

        Uses direct ORM (not EmployeeProfileService) so bulk import stays light and
        does not trip company-scope / enrich paths mid-batch.
        """
        raw = raw or {}
        marital = str(raw.get("marital_status") or "").strip() or None
        blood = str(raw.get("blood_group") or "").strip() or None
        nationality = str(raw.get("nationality") or "").strip() or None
        aadhaar = str(raw.get("aadhaar") or "").strip() or None
        pan = str(raw.get("pan") or "").strip() or None
        uan = str(raw.get("uan") or "").strip() or None
        bank_name = str(raw.get("bank_name") or "").strip() or None
        bank_account = str(raw.get("bank_account") or "").strip() or None
        bank_ifsc = str(raw.get("bank_ifsc") or "").strip() or None
        bank_holder = str(raw.get("bank_holder") or "").strip() or None
        emergency_name = str(raw.get("emergency_name") or "").strip() or None
        emergency_phone = str(raw.get("emergency_phone") or "").strip() or None
        current_address = str(raw.get("current_address") or "").strip()
        permanent_address = str(raw.get("permanent_address") or "").strip()
        current_json = {"line1": current_address} if current_address else None
        permanent_json = {"line1": permanent_address} if permanent_address else None
        tag = _normalize_workforce_tag(raw.get("tag"))
        deployed_at = str(raw.get("deployed_at") or "").strip() or None

        has_any = any(
            [
                gender,
                date_of_birth is not None,
                marital,
                blood,
                nationality,
                aadhaar,
                pan,
                uan,
                bank_name,
                bank_account,
                bank_ifsc,
                bank_holder,
                emergency_name,
                emergency_phone,
                current_json,
                permanent_json,
                tag,
                deployed_at,
            ]
        )
        if not has_any:
            return

        existing = self._db.scalar(
            select(HrEmployeeProfile).where(
                HrEmployeeProfile.employee_id == employee_id,
                HrEmployeeProfile.is_deleted.is_(False),
            )
        )
        if existing is None:
            existing = self._db.scalar(
                select(HrEmployeeProfile).where(HrEmployeeProfile.employee_id == employee_id)
            )
            if existing is not None and existing.is_deleted:
                existing.is_deleted = False
                existing.deleted_at = None
                existing.deleted_by = None

        def _apply(row: HrEmployeeProfile) -> None:
            row.company_id = company_id
            row.branch_id = branch_id
            row.status = "active"
            if gender:
                row.gender = gender
            if date_of_birth is not None:
                row.date_of_birth = date_of_birth
            if marital:
                row.marital_status = marital.lower()
            if blood:
                row.blood_group = blood.upper()
            if nationality:
                row.nationality = nationality
            if aadhaar:
                row.aadhaar_number = aadhaar
            if pan:
                row.pan_number = pan.upper()
            if uan:
                row.uan_number = uan
            if bank_name:
                row.bank_name = bank_name
            if bank_account:
                row.bank_account_number = bank_account
            if bank_ifsc:
                row.bank_ifsc = bank_ifsc.upper()
            if bank_holder:
                row.bank_account_holder = bank_holder
            if emergency_name:
                row.emergency_contact_name = emergency_name
            if emergency_phone:
                row.emergency_contact_mobile = emergency_phone
            if current_json:
                row.current_address_json = current_json
            if permanent_json:
                row.permanent_address_json = permanent_json
            if tag or deployed_at:
                row.skills_json = _merge_skills_meta(
                    row.skills_json, tag=tag, deployed_at=deployed_at
                )
                flag_modified(row, "skills_json")
            row.updated_at = hr_utcnow()
            row.updated_by = ctx.user_id
            row.version = int(row.version or 1) + 1

        if existing is not None:
            _apply(existing)
            self._db.flush()
            return

        row = HrEmployeeProfile(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            employee_id=employee_id,
            gender=gender,
            date_of_birth=date_of_birth,
            marital_status=marital.lower() if marital else None,
            blood_group=blood.upper() if blood else None,
            nationality=nationality,
            aadhaar_number=aadhaar,
            pan_number=pan.upper() if pan else None,
            uan_number=uan,
            bank_name=bank_name,
            bank_account_number=bank_account,
            bank_ifsc=bank_ifsc.upper() if bank_ifsc else None,
            bank_account_holder=bank_holder,
            emergency_contact_name=emergency_name,
            emergency_contact_mobile=emergency_phone,
            current_address_json=current_json,
            permanent_address_json=permanent_json,
            skills_json=_merge_skills_meta(None, tag=tag, deployed_at=deployed_at)
            if (tag or deployed_at)
            else None,
            status="active",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(row)
        self._db.flush()

    def backfill_default_tag(
        self,
        ctx: TenantContext,
        *,
        default_tag: str = "office_staff",
        only_missing: bool = True,
    ) -> dict:
        """Stamp existing employee profiles with a default workforce tag."""
        tag = _normalize_workforce_tag(default_tag) or "office_staff"
        profiles = list(
            self._db.scalars(
                select(HrEmployeeProfile).where(
                    HrEmployeeProfile.tenant_id == ctx.tenant_id,
                    HrEmployeeProfile.is_deleted.is_(False),
                )
            ).all()
        )
        updated = 0
        skipped = 0
        for profile in profiles:
            existing_tags = _skills_tags(profile.skills_json)
            if only_missing and existing_tags:
                skipped += 1
                continue
            if tag in existing_tags:
                skipped += 1
                continue
            profile.skills_json = _merge_skills_tag(profile.skills_json, tag)
            flag_modified(profile, "skills_json")
            profile.updated_at = hr_utcnow()
            profile.updated_by = ctx.user_id
            profile.version = int(profile.version or 1) + 1
            updated += 1

        # Employees with no profile yet — create a minimal profile so the tag sticks.
        emp_ids_with_profile = {p.employee_id for p in profiles}
        employees = list(
            self._db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.tenant_id == ctx.tenant_id,
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all()
        )
        for emp in employees:
            if emp.id in emp_ids_with_profile:
                continue
            branch_id = getattr(emp, "branch_id", None)
            company_id = getattr(emp, "company_id", None)
            if not branch_id or not company_id:
                skipped += 1
                continue
            row = HrEmployeeProfile(
                id=uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=company_id,
                branch_id=branch_id,
                employee_id=emp.id,
                skills_json=_merge_skills_tag(None, tag),
                status="active",
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._db.add(row)
            updated += 1

        self._db.flush()
        return {
            "updated": updated,
            "skipped": skipped,
            "default_tag": tag,
            "message": f"Tagged {updated} employee(s) as {tag}",
        }

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
        stmt = select(EmployeeRead).where(
            EmployeeRead.is_deleted.is_(False),
            EmployeeRead.id.in_(list(code_to_id.values())),
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
