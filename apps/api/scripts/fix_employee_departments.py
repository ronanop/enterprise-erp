"""Reassign employees from catch-all General to real departments.

Priority:
1. Client CSV Department column (var/client-side-*.csv) when code matches
2. Designation → department inference
3. Leave as General only when nothing else fits

Usage (from apps/api):
  .venv\\Scripts\\python.exe scripts/fix_employee_departments.py
"""

from __future__ import annotations

import csv
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent.parent
sys.path.insert(0, str(ROOT / "src"))
load_dotenv(REPO / ".env", override=True)

from database.session import SessionLocal  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.organization.models.hierarchy import OrgDepartment  # noqa: E402

_ = (OrgCompany, OrgBranch)

CSV_PATHS = [
    REPO / "var" / "client-side-import.csv",
    REPO / "var" / "client-side-digitech.csv",
    REPO / "var" / "client-side-technologies.csv",
]


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").strip().lower())


def _candidates(code: str) -> list[str]:
    c = str(code or "").strip().upper()
    if not c:
        return []
    out = [c]
    if c.startswith("CTS") and c[3:].isdigit():
        n = c[3:]
        out.extend([f"CT{n}", f"CT5{n}", f"CDPL5{n}", f"CDPL{n}"])
    if c.startswith("CT") and c[2:].isdigit():
        n = c[2:]
        out.extend([f"CTS{n}", f"CDPL{n}", f"VPL{n}"])
    if c.startswith("CDPL") and c[4:].isdigit():
        n = c[4:]
        out.extend([f"CT{n}", f"VPL{n}"])
    seen: set[str] = set()
    uniq: list[str] = []
    for x in out:
        x = x.strip().upper()
        if x and x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq


def infer_department(designation: str) -> str:
    d = (designation or "").strip().lower()
    if not d:
        return "General"

    if any(
        x in d
        for x in (
            "talent acquisition",
            "ta manager",
            "hr head",
            " hr",
            "hr ",
        )
    ) or d in {"hr", "hr head"} or d.startswith("hr"):
        return "HR"

    if any(x in d for x in ("marketing", "graphic designer")):
        return "Marketing"

    if any(
        x in d
        for x in (
            "supply chain",
            "logistics",
            "scm ",
            "warehouse",
            "purchase",
            "travel desk",
        )
    ):
        return "Supply Chain/ Logistics"

    if any(
        x in d
        for x in (
            "finance",
            "accountant",
            "accounts",
            "account ",
        )
    ) or d.endswith(" account") or "accounts &" in d:
        return "Finance"

    if any(
        x in d
        for x in (
            "sales",
            "key account",
            "business development",
            "inside sales",
            "isr",
            "presales",
            "pre sales",
            "tender",
            "alliance",
            "account executive",
            "field executive",
            "field executiive",
            "field boy",
            "lead isr",
        )
    ):
        return "Sales"

    if any(
        x in d
        for x in (
            "office boy",
            "housekeeping",
            "driver",
            "facility",
            "admin",
            "ea to ceo",
            "operations executive",
        )
    ) or d == "admin":
        return "Admin"

    # Tech/AI VPs stay Technical (many entities have Technical but not Management).
    if d.startswith("vp") or " vp" in d or d.startswith("vp-") or "vp -" in d or "vp-" in d:
        if any(
            x in d
            for x in (
                "cloud",
                "ai",
                "security",
                "information",
                "technology",
                "technical",
                "enterprise",
            )
        ):
            if "sales" in d or "alliance" in d:
                return "Sales"
            return "Technical"
        if "sales" in d or "alliance" in d:
            return "Sales"
        return "Management"

    if any(
        x in d
        for x in (
            "ceo",
            "managing director",
            "business head",
            "business operation",
            "gm project",
            "operations head",
        )
    ):
        return "Management"

    # Default engineering / delivery / security / IT → Technical
    return "Technical"


def _fallback_names(preferred: str) -> list[str]:
    p = preferred.strip()
    if p == "Finance":
        return ["Finance", "Accounts", "General"]
    if p == "Accounts":
        return ["Accounts", "Finance", "General"]
    if p == "Marketing":
        return ["Marketing", "Sales", "General"]
    if p == "Management":
        return ["Management", "Admin", "Technical", "General"]
    if p == "Supply Chain/ Logistics":
        return ["Supply Chain/ Logistics", "Admin", "General"]
    if p == "HR":
        return ["HR", "Admin", "General"]
    if p == "Admin":
        return ["Admin", "General"]
    if p == "Sales":
        return ["Sales", "General"]
    if p == "Technical":
        return ["Technical", "General"]
    return [p, "General"]


def load_csv_departments() -> dict[str, str]:
    out: dict[str, str] = {}
    for path in CSV_PATHS:
        if not path.exists():
            continue
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                code = str(row.get("New E codes") or row.get("EMPLOYEE ID") or "").strip().upper()
                dept = str(row.get("Department") or "").strip()
                if not code or not dept:
                    continue
                for cand in _candidates(code):
                    out.setdefault(cand, dept)
    return out


def main() -> None:
    csv_depts = load_csv_departments()
    db = SessionLocal()
    try:
        departments = list(
            db.scalars(select(OrgDepartment).where(OrgDepartment.is_deleted.is_(False))).all()
        )
        by_company_branch: dict[tuple, list[OrgDepartment]] = defaultdict(list)
        for d in departments:
            by_company_branch[(d.company_id, d.branch_id)].append(d)

        def resolve_dept(company_id, branch_id, preferred: str) -> OrgDepartment | None:
            pool = by_company_branch.get((company_id, branch_id), [])
            if not pool:
                # any dept on company (wrong branch still better than nothing? no — create)
                pool = [d for d in departments if d.company_id == company_id]
            for name in _fallback_names(preferred):
                want = _norm(name)
                for d in pool:
                    if _norm(d.department_name) == want and d.branch_id == branch_id:
                        return d
                for d in pool:
                    if _norm(d.department_name) == want:
                        return d
            # create under branch if missing
            if branch_id and company_id and preferred:
                clean = preferred.strip() or "General"
                code = re.sub(r"[^A-Z0-9]+", "-", clean.upper()).strip("-")[:40] or "DEPT"
                # unique-ish code
                code = f"DEPT-{code}"[:50]
                existing = next(
                    (
                        d
                        for d in by_company_branch.get((company_id, branch_id), [])
                        if _norm(d.department_name) == _norm(clean)
                    ),
                    None,
                )
                if existing:
                    return existing
                tenant_id = next(
                    (d.tenant_id for d in departments if d.company_id == company_id),
                    None,
                )
                if tenant_id is None:
                    return None
                created = OrgDepartment(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    company_id=company_id,
                    branch_id=branch_id,
                    department_code=code,
                    department_name=clean,
                    status="active",
                )
                db.add(created)
                db.flush()
                by_company_branch[(company_id, branch_id)].append(created)
                departments.append(created)
                return created
            return None

        employees = list(
            db.scalars(select(MasterEmployee).where(MasterEmployee.is_deleted.is_(False))).all()
        )
        by_code = {str(e.employee_code or "").strip().upper(): e for e in employees}

        updated = 0
        skipped = 0
        created_depts = 0
        before_counts = Counter()
        after_counts = Counter()
        source_counts = Counter()

        # snapshot current names
        dept_name = {d.id: d.department_name for d in departments}

        for emp in employees:
            before_counts[dept_name.get(emp.department_id, "(none)")] += 1
            code = str(emp.employee_code or "").strip().upper()
            preferred = ""
            src = ""
            for cand in _candidates(code):
                if cand in csv_depts:
                    preferred = csv_depts[cand]
                    src = "csv"
                    break
                # also match emp itself if csv keyed differently
            if not preferred and code in csv_depts:
                preferred = csv_depts[code]
                src = "csv"
            if not preferred:
                preferred = infer_department(str(emp.designation or ""))
                src = "designation"

            target = resolve_dept(emp.company_id, emp.branch_id, preferred)
            if target is None:
                skipped += 1
                after_counts[dept_name.get(emp.department_id, "(none)")] += 1
                continue

            if emp.department_id == target.id:
                skipped += 1
                after_counts[target.department_name] += 1
                continue

            emp.department_id = target.id
            emp.version = int(emp.version or 1) + 1
            updated += 1
            source_counts[src] += 1
            after_counts[target.department_name] += 1
            dept_name[target.id] = target.department_name

        db.commit()
        print(f"employees={len(employees)}")
        print(f"updated={updated}")
        print(f"unchanged_or_skipped={skipped}")
        print(f"sources={dict(source_counts)}")
        print("before=" + str(dict(before_counts)))
        print("after=" + str(dict(after_counts)))
        print("done")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
